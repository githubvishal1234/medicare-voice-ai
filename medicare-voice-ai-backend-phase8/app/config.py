# from typing import Optional

# from pydantic_settings import BaseSettings, SettingsConfigDict
# from sqlalchemy.engine import URL

# DEFAULT_SECRET_KEY = "change-this-to-a-random-secret-in-production"


# class Settings(BaseSettings):
#     # If DATABASE_URL is set explicitly (e.g. a full mssql+pyodbc://... URL),
#     # it always wins and the DB_* fields below are ignored. This preserves
#     # the original single-variable config style.
#     database_url: str = "sqlite:///./medvoice.db"

#     # --- SQL Server connection (used only if DATABASE_URL is left at the
#     # sqlite default above and these are populated via .env). Split into
#     # parts so credentials never need to be hand-assembled/URL-encoded by
#     # whoever fills in the .env file. ---
#     db_server: Optional[str] = None  # e.g. "myserver.database.windows.net" or "localhost\\SQLEXPRESS"
#     db_port: Optional[int] = None  # e.g. 1433 (optional; omit for named instances)
#     db_name: Optional[str] = None  # e.g. "Medivoice2"
#     db_user: Optional[str] = None  # omit together with db_password to use Windows/trusted auth
#     db_password: Optional[str] = None
#     db_driver: str = "ODBC Driver 18 for SQL Server"
#     db_encrypt: bool = True
#     db_trust_server_certificate: bool = True  # set False once a proper CA-signed cert is in place

#     secret_key: str = DEFAULT_SECRET_KEY
#     algorithm: str = "HS256"
#     access_token_expire_minutes: int = 1440
#     cors_origins: str = "http://localhost:5173,http://localhost:3000"

#     # --- Phase 8: environment / logging ---
#     # "development" (default, preserves existing local-dev behavior) or
#     # "production" (tightens docs exposure + enforces secret_key hygiene).
#     environment: str = "development"
#     log_level: str = "INFO"

#     # --- Phase 8: DB engine pooling (ignored for SQLite) ---
#     db_pool_size: int = 10
#     db_max_overflow: int = 20
#     db_pool_timeout_seconds: int = 30

#     # --- Phase 8: auth hardening ---
#     min_password_length: int = 8
#     login_rate_limit_attempts: int = 10
#     login_rate_limit_window_seconds: int = 300
#     register_rate_limit_attempts: int = 5
#     register_rate_limit_window_seconds: int = 3600

#     # --- Phase 8: outbound EHR HTTP client (retry/timeout) ---
#     ehr_http_timeout_seconds: float = 8.0
#     ehr_http_max_retries: int = 2
#     ehr_http_retry_backoff_seconds: float = 0.5

#     # --- Phase 8: request body / upload limits ---
#     max_upload_bytes: int = 20 * 1024 * 1024  # 20 MB

#     model_config = SettingsConfigDict(env_file=".env", extra="ignore")

#     @property
#     def cors_origin_list(self) -> list[str]:
#         return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

#     @property
#     def is_production(self) -> bool:
#         return self.environment.strip().lower() == "production"

#     @property
#     def uses_default_secret_key(self) -> bool:
#         return self.secret_key == DEFAULT_SECRET_KEY

#     @property
#     def resolved_database_url(self):
#         """
#         Effective SQLAlchemy URL. If DATABASE_URL was overridden away from
#         the sqlite default, use it as-is (covers a full mssql+pyodbc://...
#         connection string, or anything else). Otherwise, if DB_SERVER +
#         DB_NAME are set, build a mssql+pyodbc URL from the split fields so
#         the .env file never has to hand-encode a password.
#         """
#         if self.database_url != "sqlite:///./medvoice.db":
#             return self.database_url

#         if self.db_server and self.db_name:
#             query = {
#                 "driver": self.db_driver,
#                 "Encrypt": "yes" if self.db_encrypt else "no",
#                 "TrustServerCertificate": "yes" if self.db_trust_server_certificate else "no",
#             }
#             if not self.db_user:
#                 # No credentials supplied -> Windows/trusted auth.
#                 query["Trusted_Connection"] = "yes"
#             host = self.db_server
#             return URL.create(
#                 "mssql+pyodbc",
#                 username=self.db_user or None,
#                 password=self.db_password or None,
#                 host=host,
#                 port=self.db_port,
#                 database=self.db_name,
#                 query=query,
#             )

#         return self.database_url


# settings = Settings()











from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL

DEFAULT_SECRET_KEY = "change-this-to-a-random-secret-in-production"


class Settings(BaseSettings):
    # ============================================================
    # SQL SERVER ONLY
    # ============================================================

    db_server: str
    db_port: int
    db_name: str
    db_user: str
    db_password: str

    db_driver: str = "ODBC Driver 18 for SQL Server"
    db_encrypt: bool = True
    db_trust_server_certificate: bool = True

    # ============================================================
    # AUTH
    # ============================================================

    secret_key: str = DEFAULT_SECRET_KEY
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # ============================================================
    # ENVIRONMENT / LOGGING
    # ============================================================

    environment: str = "development"
    log_level: str = "INFO"

    # ============================================================
    # DATABASE POOL
    # ============================================================

    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout_seconds: int = 30

    # ============================================================
    # AUTH HARDENING
    # ============================================================

    min_password_length: int = 8

    login_rate_limit_attempts: int = 10
    login_rate_limit_window_seconds: int = 300

    register_rate_limit_attempts: int = 5
    register_rate_limit_window_seconds: int = 3600

    # ============================================================
    # EHR HTTP CLIENT
    # ============================================================

    ehr_http_timeout_seconds: float = 8.0
    ehr_http_max_retries: int = 2
    ehr_http_retry_backoff_seconds: float = 0.5

    # ============================================================
    # PATIENT NOTIFICATIONS (appointment confirmations)
    # ============================================================
    # All optional — if a channel's settings are left unset, that channel
    # is silently skipped (same "not_configured, never break the caller's
    # primary action" philosophy as the EHR sync client below).

    # Email — sent via any SMTP provider (Gmail, SES, SendGrid SMTP relay, etc.)
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_from_name: str = "MedVoice Clinic"
    smtp_use_tls: bool = True

    # WhatsApp — sent via Twilio's WhatsApp Business API.
    # whatsapp_from_number is the Twilio-provisioned sender, e.g. "whatsapp:+14155238886".
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    whatsapp_from_number: Optional[str] = None

    notification_http_timeout_seconds: float = 8.0

    # ============================================================
    # UPLOAD LIMIT
    # ============================================================

    max_upload_bytes: int = 20 * 1024 * 1024

    # ============================================================
    # ENVIRONMENT FILE
    # ============================================================

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    # ============================================================
    # HELPERS
    # ============================================================

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() == "production"

    @property
    def uses_default_secret_key(self) -> bool:
        return self.secret_key == DEFAULT_SECRET_KEY

    # ============================================================
    # SQL SERVER CONNECTION
    # ============================================================

    @property
    def resolved_database_url(self):
        """
        SQL Server is the ONLY supported database.

        No SQLite fallback.
        """

        server = self.db_server

        if self.db_port:
            server = f"{server},{self.db_port}"

        query = {
            "driver": self.db_driver,
            "Encrypt": "yes" if self.db_encrypt else "no",
            "TrustServerCertificate": (
                "yes"
                if self.db_trust_server_certificate
                else "no"
            ),
        }

        return URL.create(
            "mssql+pyodbc",
            username=self.db_user,
            password=self.db_password,
            host=server,
            database=self.db_name,
            query=query,
        )


settings = Settings()