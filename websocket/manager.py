import asyncio
import logging
from typing import Set, Dict, Any
from fastapi import WebSocket, WebSocketDisconnect
from websocket.analytics import api_server_connection_registry

logger = logging.getLogger("api_server.websocket.manager")

class ClientWebSocketManager:
    """
    Manages client WebSocket channels ( Flutter, Web, Android Widget ).
    Pushes real-time spot updates and maintains active analytics registry metrics.
    """
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self.total_broadcasts_count = 0
        self._heartbeat_task: Any = None

    async def connect(self, websocket: WebSocket):
        # Resolve request headers for telemetry profile
        headers = dict(websocket.headers)
        user_agent = headers.get("user-agent", "Unknown Client")
        
        # Resolve real client IP across potential load balancers / Nginx proxies
        x_forwarded_for = headers.get("x-forwarded-for", "")
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(",")[0].strip()
        else:
            ip_address = websocket.client.host if websocket.client else "127.0.0.1"

        await websocket.accept()
        
        # Register connection to the central analytics tracker
        api_server_connection_registry.register(websocket, user_agent, ip_address)
        
        async with self._lock:
            self.active_connections.add(websocket)
            # Lazily start backend heartbeat monitor task under active loop
            if not self._heartbeat_task or self._heartbeat_task.done():
                self._heartbeat_task = asyncio.create_task(self._heartbeat_monitor())
                
        logger.info(f"Client connected. Active pools: {len(self.active_connections)}")
        
        # Immediately broadcast updated client list to admins
        from metrics.manager import api_server_metrics_manager
        asyncio.create_task(api_server_metrics_manager.broadcast_telemetry_immediately())

    async def disconnect(self, websocket: WebSocket, is_clean: bool = True):
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
                
        # Clean up tracker memory registry, keeping metadata temporarily if unclean
        api_server_connection_registry.deregister(websocket, is_clean=is_clean)
        logger.info(f"Client disconnected. Active pools: {len(self.active_connections)}")
        
        # Immediately broadcast updated client list to admins
        from metrics.manager import api_server_metrics_manager
        asyncio.create_task(api_server_metrics_manager.broadcast_telemetry_immediately())

    async def broadcast(self, message: str, ignore_gate: bool = False) -> None:
        """Broadcasts bullion spots concurrently, shielding against stalling socket nodes."""
        from backend.app.core.stream_state import STREAMING_ENABLED
        if not STREAMING_ENABLED and not ignore_gate:
            return

        async with self._lock:
            if not self.active_connections:
                return
            connections = list(self.active_connections)

        # Track broadcast rates metrics
        self.total_broadcasts_count += len(connections)
        
        # Isolated thread task gatherer
        tasks = [self._send_to_client(websocket, message) for websocket in connections]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _send_to_client(self, websocket: WebSocket, message: str) -> None:
        try:
            # Shield writes with small 1.0s timeout to maintain high throughput speed
            await asyncio.wait_for(websocket.send_text(message), timeout=1.0)
        except (asyncio.TimeoutError, WebSocketDisconnect, Exception):
            await self.disconnect(websocket, is_clean=False)
            try:
                await websocket.close()
            except Exception:
                pass

    async def _heartbeat_monitor(self) -> None:
        """Periodically pings active sockets, cleans up dead connections and stale records."""
        from backend.app.config import settings
        interval = getattr(settings, "WS_HEARTBEAT_INTERVAL_SECS", 30)
        logger.info(f"Backend Client WebSocket Heartbeat thread initialized (runs every {interval}s).")
        
        while True:
            try:
                await asyncio.sleep(interval)
                
                # 1. Ping active connections to find dead sockets
                async with self._lock:
                    if not self.active_connections:
                        connections = []
                    else:
                        connections = list(self.active_connections)
                
                dead_sockets = []
                for ws in connections:
                    try:
                        # Send lightweight ping string frame to client
                        await asyncio.wait_for(ws.send_text("ping"), timeout=2.0)
                    except Exception:
                        dead_sockets.append(ws)
                
                for ws in dead_sockets:
                    logger.warning(f"Closing dead client socket detected in heartbeat audit: {ws}")
                    await self.disconnect(ws, is_clean=False)
                    try:
                        await ws.close()
                    except Exception:
                        pass
                
                # 2. Collect stale offline client telemetry records (5 mins default limit)
                api_server_connection_registry.cleanup_stale_clients(expiration_seconds=300.0)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Exception inside backend heartbeat monitor: {e}", exc_info=True)


class AdminWebSocketManager:
    """
    Manages secure administrative WebSocket channels (/ws/admin).
    Streams live metrics, connections data, system configurations, and log updates.
    """
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        async with self._lock:
            self.active_connections.add(websocket)
        logger.info(f"Admin console connected. Active admin nodes: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
        logger.info(f"Admin console disconnected. Active admin nodes: {len(self.active_connections)}")

    async def broadcast_payload(self, payload: Dict[str, Any]) -> None:
        """Sends data payload (telemetry metrics or logs stream) to all active admin panels."""
        async with self._lock:
            if not self.active_connections:
                return
            connections = list(self.active_connections)

        tasks = [self._send_to_admin(websocket, payload) for websocket in connections]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _send_to_admin(self, websocket: WebSocket, payload: Dict[str, Any]) -> None:
        try:
            # Admin WebSocket runs with JSON frames directly
            await asyncio.wait_for(websocket.send_json(payload), timeout=1.5)
        except (asyncio.TimeoutError, WebSocketDisconnect, Exception):
            await self.disconnect(websocket)
            try:
                await websocket.close()
            except Exception:
                pass

# Global singleton WebSocket pools
api_server_client_ws_manager = ClientWebSocketManager()
api_server_admin_ws_manager = AdminWebSocketManager()
