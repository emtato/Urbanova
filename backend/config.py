"""Shared backend/worker settings. Environment variables override root .env."""
from pathlib import Path

from pydantic import Field, PostgresDsn, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[1]
MODEL_VERSION = "foundation-v1"
DATA_VERSION = "unloaded-v1"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env", env_file_encoding="utf-8",
        extra="ignore", frozen=True, hide_input_in_errors=True,
    )

    gemini_api_key: SecretStr = SecretStr("")
    gemini_model: str = "gemini-2.5-flash"
    database_url: PostgresDsn | None = Field(default=None, repr=False)
    data_cache_dir: Path = ROOT_DIR / "data/cache"
    sim_runs: int = Field(default=100, ge=1)

    @field_validator("database_url", mode="before")
    @classmethod
    def empty_database_url(cls, value):
        return None if value == "" else value

    @field_validator("data_cache_dir", mode="after")
    @classmethod
    def absolute_cache_path(cls, value: Path) -> Path:
        return value if value.is_absolute() else ROOT_DIR / value

    @property
    def active_database_url(self) -> str:
        if self.database_url is None:
            raise ValueError("Set DATABASE_URL in the root .env to your Tiger Data connection URL.")
        return str(self.database_url)


settings = Settings()
