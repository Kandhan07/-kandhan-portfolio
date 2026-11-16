import re

from pydantic import BaseModel, EmailStr, Field, field_validator

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _clean_line(value: str) -> str:
    """Single-line fields: remove control chars / line breaks (blocks header injection)."""
    return re.sub(r"\s+", " ", _CONTROL.sub("", value)).strip()


class ContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    subject: str = Field(default="", max_length=120)
    message: str = Field(min_length=10, max_length=2000)
    website: str = Field(default="", max_length=200)  # honeypot: humans leave this empty

    @field_validator("name", "subject", mode="before")
    @classmethod
    def clean_single_line(cls, v):
        return _clean_line(v) if isinstance(v, str) else v

    @field_validator("message", mode="before")
    @classmethod
    def clean_message(cls, v):
        return _CONTROL.sub("", v).strip() if isinstance(v, str) else v


class ContactOut(BaseModel):
    ok: bool = True
    detail: str = "Thanks! Your message has been sent."
