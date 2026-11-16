from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings


class Base(DeclarativeBase):
    pass


def normalize_database_url(url: str) -> tuple[str, dict]:
    """Accept the URL styles given by Neon / Render / Supabase and make it asyncpg-ready."""
    connect_args: dict = {}

    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]

    if url.startswith("postgresql+asyncpg://"):
        parts = urlsplit(url)
        query = dict(parse_qsl(parts.query))
        sslmode = query.pop("sslmode", None)
        query.pop("channel_binding", None)  # asyncpg does not understand this libpq option
        if sslmode and sslmode != "disable":
            connect_args["ssl"] = True
        connect_args["statement_cache_size"] = 0  # safe with pooled (pgbouncer) endpoints
        url = urlunsplit(parts._replace(query=urlencode(query)))

    return url, connect_args


_url, _connect_args = normalize_database_url(get_settings().database_url)

engine = create_async_engine(
    _url,
    connect_args=_connect_args,
    pool_pre_ping=True,  # free DBs go to sleep; this revives stale connections
    pool_recycle=300,
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session():
    async with SessionLocal() as session:
        yield session
