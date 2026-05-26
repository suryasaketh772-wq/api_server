import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    ENVIRONMENT: str = "production"
    APP_NAME: str = "Bullion Realtime Pricing Server"
    
    # Administrative Dashboard Credentials & Cryptography Keys
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin123"
    JWT_SECRET_KEY: str = "api_server_super_secret_key_dpgold_admin_2026_99x"
    
    # DPGold API Settings
    # If empty, the polling service will run in MOCK mode generating real-time prices.
    DPGOLD_API_URL: str = ""
    DPGOLD_API_KEY: str = ""
    
    # Polling & WebSocket Tuning
    POLL_INTERVAL_SECS: int = 2
    WS_HEARTBEAT_INTERVAL_SECS: int = 30
    
    # Security: CORS Allowed Origins
    # Expected format: JSON list or comma-separated string
    ALLOWED_ORIGINS: Union[List[str], str] = ["*"]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
