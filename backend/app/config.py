"""
Application configuration.
Values are read from environment variables so you can point the app at a real
MongoDB instance without touching code. A .env file is supported via pydantic-settings.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # MongoDB connection. Override MONGODB_URI in your .env for a real server / Atlas.
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "millionaire"

    # Game rules
    questions_per_level: int = 5          # how many questions we draw per difficulty
    difficulties: tuple[str, ...] = ("easy", "medium", "hard")

    # CORS: the React dev server origin(s) allowed to call this API
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # When true, seed the DB on startup if it has no activities (handy in Docker).
    seed_on_startup: bool = False

    # --- Users / sessions -------------------------------------------------
    # HMAC key that signs login tokens. REQUIRED — the app refuses to start
    # without it. Use a long random string and never commit it.
    session_secret: str = ""
    # How long a login lasts before the player has to sign in again (seconds).
    session_ttl: int = 7 * 24 * 3600

    # First-admin bootstrap. If BOTH are set and no admin exists yet, this
    # account is created as an admin on startup. Ignored once an admin exists —
    # remove the password from the environment after the first deploy.
    bootstrap_admin_email: str = ""
    bootstrap_admin_password: str = ""


settings = Settings()
