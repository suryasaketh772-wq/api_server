import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from backend.app.cache import price_cache
from websocket.manager import api_server_client_ws_manager
from backend.app.polling import bullion_polling_service
from backend.app.models import BullionPrice, HealthStatus

router = APIRouter()
SERVER_START_TIME = time.time()

@router.websocket("/ws/prices")
async def websocket_prices_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time client bullion pricing updates.
    Delegates connection accepts and tracking metrics to api_server_client_ws_manager.
    """
    await api_server_client_ws_manager.connect(websocket)
    
    # Proactively push current cached data instantly on connection to minimize client wait time
    current_price = await price_cache.get_latest_price()
    if current_price:
        try:
            import json
            dual_payload = {
                "gold_spot": current_price.gold_spot,
                "silver_spot": current_price.silver_spot,
                "usd_inr": current_price.usd_inr,
                "gold_high": current_price.gold_high,
                "gold_low": current_price.gold_low,
                "silver_high": current_price.silver_high,
                "silver_low": current_price.silver_low,
                "timestamp": current_price.timestamp,
                
                # Existing Flutter app WebSocket payload contract
                "type": "price_update",
                "data": {
                    "gold": current_price.gold_spot,
                    "gold_high": current_price.gold_high,
                    "gold_low": current_price.gold_low,
                    "silver": current_price.silver_spot,
                    "silver_high": current_price.silver_high,
                    "silver_low": current_price.silver_low,
                    "usdinr": current_price.usd_inr
                }
            }
            await websocket.send_text(json.dumps(dual_payload))
        except Exception:
            # Client disconnected immediately after connect
            await api_server_client_ws_manager.disconnect(websocket, is_clean=False)
            return

    try:
        # Keep connection open and await incoming client messages (or pong keep-alives)
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
            elif msg == "pong":
                # Handle client responding to backend pings
                pass
    except WebSocketDisconnect as e:
        is_clean = e.code in [1000, 1001]
        await api_server_client_ws_manager.disconnect(websocket, is_clean=is_clean)
    except Exception:
        await api_server_client_ws_manager.disconnect(websocket, is_clean=False)

@router.get("/api/v1/prices")
async def get_prices_v1():
    """
    REST v1 compat endpoint for existing Flutter app.
    Returns flat pricing structures mapped cleanly.
    """
    current_price = await price_cache.get_latest_price()
    if not current_price:
        raise HTTPException(
            status_code=503, 
            detail="Bullion prices are currently unavailable."
        )
    return {
        "gold": current_price.gold_spot,
        "gold_high": current_price.gold_high,
        "gold_low": current_price.gold_low,
        "silver": current_price.silver_spot,
        "silver_high": current_price.silver_high,
        "silver_low": current_price.silver_low,
        "usdinr": current_price.usd_inr,
        "usdinr_high": current_price.usd_inr,
        "usdinr_low": current_price.usd_inr,
        "timestamp": current_price.timestamp
    }

@router.get("/api/latest", response_model=BullionPrice)
async def get_latest_price():
    """
    REST fallback endpoint. Returns the latest cached bullion price.
    Acts as a backup if the client WebSocket connection fails or dropped.
    """
    current_price = await price_cache.get_latest_price()
    if not current_price:
        raise HTTPException(
            status_code=503, 
            detail="Bullion prices are currently unavailable. Polling service initializing."
        )
    return current_price

@router.get("/health", response_model=HealthStatus)
async def get_health_status():
    """
    Comprehensive service health check.
    Provides real-time stats including current active WebSockets, polling states, and server uptime.
    """
    uptime = time.time() - SERVER_START_TIME
    last_poll = await price_cache.get_last_poll_timestamp()
    
    return HealthStatus(
        status="healthy",
        websocket_connections=api_server_client_ws_manager.active_connections.__len__(),
        polling_active=bullion_polling_service.is_running,
        uptime_seconds=round(uptime, 2),
        mock_mode=bullion_polling_service.mock_mode,
        last_poll_timestamp=last_poll
    )
