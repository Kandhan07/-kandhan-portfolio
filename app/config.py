from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # "production" hides nothing important, but keeps logs quieter
    app_env: str = "development"
    # Your real domain, e.g. https://kandhan.dev  (used for SEO / sitemap)
    site_url: str = "http://localhost:8000"

    # SQLite locally. On Render/Neon use the Postgres URL (any postgres:// form works).
    database_url: str = "sqlite+aiosqlite:///./portfolio.db"

    # Where enquiry mails are delivered
    notify_email: str = "kandhanchandrasekar@gmail.com"

    # --- Email option 1 (recommended for free hosting): Resend, HTTPS API ---
    resend_api_key: str = ""
    mail_from: str = "Portfolio <onboarding@resend.dev>"

    # --- Email option 2: SMTP (works locally; blocked on Render free tier) ---
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""

    # Contact form rate limit per IP
    contact_rate_limit: str = "5/hour"


@lru_cache
def get_settings() -> Settings:
    return Settings()
