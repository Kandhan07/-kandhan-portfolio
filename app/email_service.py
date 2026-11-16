"""Sends the 'new enquiry' mail to the portfolio owner.

Order of preference:
  1. Resend HTTPS API  (works on free hosts that block SMTP, e.g. Render free)
  2. SMTP (Gmail App Password) - fine for local use / paid hosts
If neither is configured the message is still saved in the database.
"""
import html
import logging
from email.message import EmailMessage

import aiosmtplib
import httpx

from .config import get_settings
from .models import ContactMessage

log = logging.getLogger("portfolio.email")


def _subject(msg: ContactMessage) -> str:
    topic = msg.subject or "New enquiry"
    return f"[Portfolio] {topic} - {msg.name}"[:200]


def _text_body(msg: ContactMessage) -> str:
    return (
        f"New message from your portfolio website\n\n"
        f"Name:    {msg.name}\n"
        f"Email:   {msg.email}\n"
        f"Subject: {msg.subject or '-'}\n\n"
        f"{msg.message}\n"
    )


def _html_body(msg: ContactMessage) -> str:
    e = html.escape
    return (
        "<div style='font-family:Arial,sans-serif;max-width:560px'>"
        "<h2 style='margin:0 0 12px'>New message from your portfolio</h2>"
        f"<p><b>Name:</b> {e(msg.name)}<br>"
        f"<b>Email:</b> <a href='mailto:{e(msg.email)}'>{e(msg.email)}</a><br>"
        f"<b>Subject:</b> {e(msg.subject or '-')}</p>"
        "<div style='padding:12px 16px;background:#f4f4f4;border-radius:8px;white-space:pre-wrap'>"
        f"{e(msg.message)}</div>"
        "<p style='color:#888;font-size:12px'>Hit Reply to answer the sender directly.</p></div>"
    )


async def _send_resend(msg: ContactMessage) -> None:
    s = get_settings()
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {s.resend_api_key}"},
            json={
                "from": s.mail_from,
                "to": [s.notify_email],
                "reply_to": msg.email,
                "subject": _subject(msg),
                "html": _html_body(msg),
                "text": _text_body(msg),
            },
        )
        r.raise_for_status()


async def _send_smtp(msg: ContactMessage) -> None:
    s = get_settings()
    mail = EmailMessage()
    mail["From"] = s.smtp_user
    mail["To"] = s.notify_email
    mail["Reply-To"] = msg.email
    mail["Subject"] = _subject(msg)
    mail.set_content(_text_body(msg))
    mail.add_alternative(_html_body(msg), subtype="html")
    await aiosmtplib.send(
        mail,
        hostname=s.smtp_host,
        port=s.smtp_port,
        start_tls=True,
        username=s.smtp_user,
        password=s.smtp_password,
        timeout=20,
    )


async def send_notification(msg: ContactMessage) -> bool:
    """Returns True when an email was handed to a provider. Never raises."""
    s = get_settings()
    try:
        if s.resend_api_key:
            await _send_resend(msg)
        elif s.smtp_user and s.smtp_password:
            await _send_smtp(msg)
        else:
            log.warning("No email provider configured; message %s saved to DB only.", msg.id)
            return False
        return True
    except Exception:  # noqa: BLE001 - email must never break the form
        log.exception("Failed to send notification for message %s", msg.id)
        return False
