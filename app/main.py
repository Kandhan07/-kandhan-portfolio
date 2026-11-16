import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import BackgroundTasks, Depends, FastAPI, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .database import Base, SessionLocal, engine, get_session
from .email_service import send_notification
from .models import ContactMessage, Project
from .schemas import ContactIn, ContactOut

BASE_DIR = Path(__file__).resolve().parent
settings = get_settings()
log = logging.getLogger("portfolio")
limiter = Limiter(key_func=get_remote_address)
templates = Jinja2Templates(directory=BASE_DIR / "templates")

PROFILE = json.loads((BASE_DIR / "data" / "profile.json").read_text(encoding="utf-8"))


async def sync_projects() -> None:
    """Make the projects table mirror app/data/projects.json (edit the JSON, redeploy)."""
    items = json.loads((BASE_DIR / "data" / "projects.json").read_text(encoding="utf-8"))
    async with SessionLocal() as session:
        existing = {p.slug: p for p in (await session.scalars(select(Project))).all()}
        wanted = {i["slug"] for i in items}
        for item in items:
            row = existing.get(item["slug"])
            if row is None:
                session.add(Project(**item))
            else:
                for key, value in item.items():
                    setattr(row, key, value)
        stale = set(existing) - wanted
        if stale:
            await session.execute(delete(Project).where(Project.slug.in_(stale)))
        await session.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await sync_projects()
    yield
    await engine.dispose()


app = FastAPI(
    title="Kandhan C - Portfolio API",
    description="Backend of my portfolio: projects and contact form.",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_middleware(GZipMiddleware, minimum_size=1024)


@app.exception_handler(RateLimitExceeded)
async def rate_limited(_: Request, __: RateLimitExceeded):
    return JSONResponse(
        {"ok": False, "detail": "Too many messages from your network. Please try again later."},
        status_code=429,
    )


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    return response


app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


async def _projects(session: AsyncSession) -> list[Project]:
    result = await session.scalars(select(Project).order_by(Project.sort_order, Project.id))
    return list(result.all())


@app.get("/", include_in_schema=False)
async def home(request: Request, session: AsyncSession = Depends(get_session)):
    projects = await _projects(session)
    return templates.TemplateResponse(
        request,
        "index.html",
        {
            "p": PROFILE,
            "projects": projects,
            "categories": sorted({x.category for x in projects}),
            "site_url": settings.site_url.rstrip("/"),
        },
    )


@app.get("/api/projects", tags=["portfolio"])
async def list_projects(session: AsyncSession = Depends(get_session)):
    return [
        {
            "slug": x.slug,
            "title": x.title,
            "category": x.category,
            "summary": x.summary,
            "highlights": x.highlights,
            "stack": x.stack,
            "image_url": x.image_url,
            "github_url": x.github_url,
            "live_url": x.live_url,
        }
        for x in await _projects(session)
    ]


async def _deliver(message_id: int) -> None:
    """Background job: email the saved message and record whether it worked."""
    async with SessionLocal() as session:
        msg = await session.get(ContactMessage, message_id)
        if msg is None:
            return
        msg.email_sent = await send_notification(msg)
        await session.commit()


@app.post("/api/contact", response_model=ContactOut, tags=["portfolio"])
@limiter.limit(settings.contact_rate_limit)
async def contact(
    request: Request,
    payload: ContactIn,
    background: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
    if payload.website:  # honeypot filled in -> bot. Pretend success, store nothing.
        return ContactOut()

    msg = ContactMessage(
        name=payload.name,
        email=str(payload.email),
        subject=payload.subject,
        message=payload.message,
        ip_address=request.client.host if request.client else "",
    )
    session.add(msg)
    await session.commit()  # saved in the database first - never lost
    background.add_task(_deliver, msg.id)
    return ContactOut()


@app.get("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


@app.get("/robots.txt", include_in_schema=False)
async def robots():
    base = settings.site_url.rstrip("/")
    return PlainTextResponse(f"User-agent: *\nAllow: /\nSitemap: {base}/sitemap.xml\n")


@app.get("/sitemap.xml", include_in_schema=False)
async def sitemap():
    base = settings.site_url.rstrip("/")
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"<url><loc>{base}/</loc></url></urlset>"
    )
    return Response(xml, media_type="application/xml")
