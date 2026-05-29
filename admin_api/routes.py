import time
import logging
from collections import deque
from typing import Dict, Any, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from admin_api.auth import verify_admin_credentials, create_admin_jwt, decode_admin_jwt
from backend.app.config import settings
from websocket.manager import api_server_admin_ws_manager
from metrics.manager import api_server_metrics_manager

logger = logging.getLogger("api_server.admin_api.routes")
admin_router = APIRouter()
security_bearer = HTTPBearer()

# Buffer tracking the last 150 system events to seed dashboards on connection
MAX_LOG_HISTORY = 150
logs_history_buffer: deque = deque(maxlen=MAX_LOG_HISTORY)

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class AdminLoginResponse(BaseModel):
    token: str
    username: str

@admin_router.post("/api/admin/login", response_model=AdminLoginResponse)
async def admin_login(payload: AdminLoginRequest):
    """Processes login credentials and returns a secure 24-hour signed JWT session."""
    if verify_admin_credentials(payload.username, payload.password):
        token = create_admin_jwt(payload.username)
        return AdminLoginResponse(token=token, username=payload.username)
    
    logger.warning(f"Unauthorised login attempt using username: {payload.username}")
    raise HTTPException(status_code=401, detail="Invalid admin credentials")

@admin_router.get("/api/admin/verify")
async def admin_verify(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)):
    """Verifies standard Bearer JWT signatures for REST route route guards."""
    token = credentials.credentials
    payload = decode_admin_jwt(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    
    return {"status": "valid", "username": payload.get("sub", "admin")}

@admin_router.get("/api/admin/stream-status")
async def get_stream_status(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)):
    """Fetches the current real-time WebSocket streaming state."""
    payload = decode_admin_jwt(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    
    from backend.app.core.stream_state import STREAMING_ENABLED
    return {"enabled": STREAMING_ENABLED.enabled}

class ToggleStreamRequest(BaseModel):
    enabled: bool

@admin_router.post("/api/admin/toggle-stream")
async def toggle_stream(
    request: ToggleStreamRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security_bearer)
):
    """Dynamically activates or pauses the real-time clients price streaming engine."""
    payload = decode_admin_jwt(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    
    from backend.app.core.stream_state import STREAMING_ENABLED, STREAM_LOCK
    from websocket.manager import api_server_client_ws_manager
    import json
    
    # 1. Update shared state thread-safely under asyncio Lock
    async with STREAM_LOCK:
        STREAMING_ENABLED.enabled = request.enabled
    
    # 2. Update compatibility global variable in websocket.manager (for test suite assertions)
    import websocket.manager
    websocket.manager.STREAMING_ENABLED = request.enabled
    
    # 3. Notify all connected admin consoles instantly for cross-device sync
    await api_server_admin_ws_manager.broadcast_payload({
        "type": "stream_status_changed",
        "enabled": request.enabled
    })
    
    # 4. Notify all connected client websockets (Flutter/Web/Android)
    if not request.enabled:
        await api_server_client_ws_manager.broadcast(json.dumps({
            "type": "stream_paused"
        }), ignore_gate=True)
        logger.info("Bullion WebSocket pricing stream PAUSED by administrator.")
    else:
        await api_server_client_ws_manager.broadcast(json.dumps({
            "type": "stream_resumed"
        }), ignore_gate=True)
        logger.info("Bullion WebSocket pricing stream RESUMED by administrator.")
        
    return {"enabled": request.enabled}

@admin_router.websocket("/ws/admin")
async def admin_websocket_endpoint(websocket: WebSocket, token: str = Query(None)):
    """
    WebSocket administrative streaming engine.
    Authenticates query token, seeds starting logs and metrics, and enters a broadcast pool.
    """
    # Accept the dynamic WebSocket handshake to move socket to OPEN state
    await websocket.accept()
    
    # 1. Enforce WebSockets Authentication Bounds
    if not token:
        logger.warning("Rejected admin WS connection: Missing session token parameter.")
        await websocket.close(code=1008) # Policy Violation
        return
        
    claims = decode_admin_jwt(token)
    if not claims:
        logger.warning("Rejected admin WS connection: Invalid or expired session token.")
        await websocket.close(code=1008)
        return

    # 2. Register Connection
    await api_server_admin_ws_manager.connect(websocket)
    
    try:
        # 3. Seed historical logs instantly to populate the console terminal
        log_history_payload = {
            "type": "log_history",
            "timestamp": time.time(),
            "logs": list(logs_history_buffer)
        }
        await websocket.send_json(log_history_payload)
        
        # 4. Push active system metrics instantly to prevent dashboard layout loading delays
        initial_telemetry = await api_server_metrics_manager.get_unified_metrics_payload()
        await websocket.send_json(initial_telemetry)
        
        # 5. Continuous wait loop detecting client disconnects
        while True:
            # Listening strictly to intercept closes. Admins do not write packets back.
            _ = await websocket.receive_text()
            
    except WebSocketDisconnect:
        await api_server_admin_ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Error in admin WS channel loop: {str(e)}")
        await api_server_admin_ws_manager.disconnect(websocket)


# ============================================================================
# PYTHON ROOT LOG HANDLER INTEGRATION
# ============================================================================

class AdminLogHandler(logging.Handler):
    """
    Custom log handler redirecting application print streams straight to the admin console.
    Writes entries safely to standard thread deques and spawns async tasks to stream them.
    """
    def emit(self, record):
        try:
            # Avoid circular feedback loops from logging our own admin socket writes
            if "api_server.websocket.manager" in record.name or "api_server.admin_api.routes" in record.name:
                return

            log_entry = {
                "type": "log_event",
                "timestamp": record.created,
                "level": record.levelname,
                "logger": record.name,
                "message": self.format(record)
            }
            
            # Store in localized seed buffer
            logs_history_buffer.append(log_entry)
            
            # Asynchronously broadcast log entries to all connected console nodes
            import asyncio
            try:
                loop = asyncio.get_running_loop()
                if loop.is_running():
                    loop.create_task(api_server_admin_ws_manager.broadcast_payload(log_entry))
            except RuntimeError:
                # Runs when logging events occur outside active async event threads
                pass
        except Exception:
            pass

# Attach logging handler dynamically to capture root event logs
root_logger = logging.getLogger()
admin_handler = AdminLogHandler()
admin_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
admin_handler.setLevel(logging.INFO)
root_logger.addHandler(admin_handler)

logger.info("Custom Admin WebSocket Log Handler mounted successfully.")
