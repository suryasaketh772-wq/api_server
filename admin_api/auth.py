import time
import jwt
import logging
from typing import Dict, Optional, Any
from backend.app.config import settings

logger = logging.getLogger("api_server.admin_api.auth")

# Fallback development key if JWT_SECRET_KEY is not defined in .env
DEFAULT_SECRET = "api_server_super_secret_key_dpgold_admin_2026_99x"
JWT_SECRET = getattr(settings, "JWT_SECRET_KEY", "") or DEFAULT_SECRET
JWT_ALGORITHM = "HS256"
TOKEN_LIFETIME_SECS = 86400 # 24 hours validity

def verify_admin_credentials(username: str, password: str) -> bool:
    """Validates login credentials against secure environment variables."""
    configured_user = getattr(settings, "ADMIN_USERNAME", "admin")
    configured_pass = getattr(settings, "ADMIN_PASSWORD", "admin123")
    
    return username == configured_user and password == configured_pass

def create_admin_jwt(username: str) -> str:
    """Generates a cryptographically signed JWT token for the authenticated admin session."""
    now = time.time()
    payload = {
        "sub": username,
        "iat": int(now),
        "exp": int(now + TOKEN_LIFETIME_SECS)
    }
    
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    logger.info(f"Generated JWT session token for user: {username}")
    return token

def decode_admin_jwt(token: str) -> Optional[Dict[str, Any]]:
    """
    Decodes and validates the JWT token.
    Returns the claims dict on success, or None on expiration or signature errors.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Double-check expiration claims defensively
        if payload.get("exp", 0) < time.time():
            logger.warning("Attempted access with expired session token.")
            return None
            
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Decryption failed: Token signature expired.")
        return None
    except jwt.PyJWTError as e:
        logger.warning(f"Decryption failed: Token signature invalid: {str(e)}")
        return None
