import os
import tempfile

# Use a throw-away database for tests (must be set before the app is imported)
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test.db"
os.environ["RESEND_API_KEY"] = ""
os.environ["SMTP_USER"] = ""
os.environ["CONTACT_RATE_LIMIT"] = "1000/hour"

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

from app import email_service  # noqa: E402
from app.database import normalize_database_url  # noqa: E402
from app.main import app  # noqa: E402
from app.models import ContactMessage  # noqa: E402

VALID = {"name": "Asha", "email": "asha@example.com", "subject": "Hi", "message": "I'd like to discuss a backend role."}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def rows(sql):
    eng = create_engine(f"sqlite:///{_tmp}/test.db")
    with eng.connect() as conn:
        return conn.execute(text(sql)).fetchall()


def test_home_and_health(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "Kandhan C" in r.text and "Driver Drowsiness" in r.text
    assert client.get("/health").json() == {"status": "ok"}


def test_projects_api(client):
    data = client.get("/api/projects").json()

    assert isinstance(data, list)
    assert len(data) > 0

def test_contact_saved(client):
    r = client.post("/api/contact", json=VALID)
    assert r.status_code == 200 and r.json()["ok"] is True
    assert rows("select count(*) from contact_messages where email='asha@example.com'")[0][0] == 1


def test_contact_validation(client):
    assert client.post("/api/contact", json={**VALID, "email": "bad"}).status_code == 422
    assert client.post("/api/contact", json={**VALID, "message": "short"}).status_code == 422
    assert client.post("/api/contact", json={**VALID, "name": "x" * 200}).status_code == 422


def test_honeypot_not_stored(client):
    before = rows("select count(*) from contact_messages")[0][0]
    r = client.post("/api/contact", json={**VALID, "website": "http://spam.example"})
    assert r.status_code == 200
    assert rows("select count(*) from contact_messages")[0][0] == before


def test_header_injection_stripped(client):
    client.post("/api/contact", json={**VALID, "email": "inj@example.com", "subject": "Hello\r\nBcc: evil@x.com"})
    subject = rows("select subject from contact_messages where email='inj@example.com'")[0][0]
    assert "\n" not in subject and "\r" not in subject


@pytest.mark.anyio
async def test_resend_payload(monkeypatch):
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["auth"] = request.headers["authorization"]
        captured["json"] = __import__("json").loads(request.content)
        return httpx.Response(200, json={"id": "abc"})

    real = httpx.AsyncClient
    monkeypatch.setattr(email_service.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    monkeypatch.setattr(email_service.get_settings(), "resend_api_key", "re_test")

    msg = ContactMessage(id=1, name="Asha <b>", email="asha@example.com", subject="Hi", message="<script>x</script> hello there")
    assert await email_service.send_notification(msg) is True
    assert captured["url"] == "https://api.resend.com/emails"
    assert captured["auth"] == "Bearer re_test"
    assert captured["json"]["reply_to"] == "asha@example.com"
    assert "<script>" not in captured["json"]["html"]  # user content is HTML-escaped


@pytest.mark.anyio
async def test_email_failure_never_raises(monkeypatch):
    def handler(request):
        return httpx.Response(500)

    real = httpx.AsyncClient
    monkeypatch.setattr(email_service.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    monkeypatch.setattr(email_service.get_settings(), "resend_api_key", "re_test")
    msg = ContactMessage(id=2, name="A B", email="a@example.com", subject="", message="hello hello hello")
    assert await email_service.send_notification(msg) is False


def test_database_url_normalising():
    url, args = normalize_database_url("postgres://u:p@host/db?sslmode=require&channel_binding=require")
    assert url == "postgresql+asyncpg://u:p@host/db"
    assert args["ssl"] is True
    url, args = normalize_database_url("postgresql://u:p@host/db")
    assert url.startswith("postgresql+asyncpg://") and "ssl" not in args
    url, args = normalize_database_url("sqlite+aiosqlite:///./x.db")
    assert url == "sqlite+aiosqlite:///./x.db" and args == {}
