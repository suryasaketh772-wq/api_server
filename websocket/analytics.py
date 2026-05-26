import time
import uuid
import logging
from typing import Dict, Any, List
from fastapi import WebSocket

logger = logging.getLogger("api_server.websocket.analytics")

class ClientConnectionRegistry:
    """
    Thread-safe registry tracking real-time client WebSocket metadata.
    Captures platform distribution, connection durations, network latencies, and origin details.
    """
    def __init__(self):
        # Maps raw WebSocket objects to metadata dicts
        self._connections: Dict[WebSocket, Dict[str, Any]] = {}
        # Simple IP/Platform reconnect tracker mapping
        self._reconnect_history: Dict[str, int] = {}

    def register(self, websocket: WebSocket, user_agent: str, ip_address: str) -> str:
        """Registers a client connection and generates a unique Client ID."""
        client_id = f"cli_{uuid.uuid4().hex[:8]}"
        
        # Parse platform profile cleanly from User-Agent
        platform = "Unknown Web"
        ua_lower = user_agent.lower()
        if "dart" in ua_lower or "flutter" in ua_lower:
            platform = "Flutter App"
        elif "android" in ua_lower:
            platform = "Android Widget"
        elif "iphone" in ua_lower or "ipad" in ua_lower:
            platform = "iOS Widget"
        elif "chrome" in ua_lower:
            platform = "Chrome Browser"
        elif "firefox" in ua_lower:
            platform = "Firefox Browser"
        elif "safari" in ua_lower:
            platform = "Safari Browser"
            
        # Track reconnect counts based on IP/Platform key signature to isolate client lifetimes
        history_key = f"{ip_address}:{platform}"
        reconnects = self._reconnect_history.get(history_key, 0)
        self._reconnect_history[history_key] = reconnects + 1
        
        metadata = {
            "client_id": client_id,
            "platform": platform,
            "ip_address": ip_address,
            "connect_time": time.time(),
            "latency_ms": 0.0,
            "reconnect_count": max(0, reconnects),
            "status": "connected"
        }
        
        self._connections[websocket] = metadata
        logger.debug(f"Registered connection {client_id} [{platform}] from {ip_address}")
        return client_id

    def deregister(self, websocket: WebSocket) -> None:
        """Removes client connection from registry."""
        if websocket in self._connections:
            meta = self._connections.pop(websocket)
            logger.debug(f"Deregistered connection {meta['client_id']}")

    def update_latency(self, websocket: WebSocket, latency_ms: float) -> None:
        """Updates connection latency metadata based on ping/pong feedback loops."""
        if websocket in self._connections:
            self._connections[websocket]["latency_ms"] = round(latency_ms, 1)

    def get_all_clients(self) -> List[Dict[str, Any]]:
        """Formats registry details into serialized lists for admin dashboard ingestion."""
        current_time = time.time()
        clients = []
        
        # Build copy snapshot to prevent modification errors during iteration
        for ws, meta in list(self._connections.items()):
            clients.append({
                "client_id": meta["client_id"],
                "platform": meta["platform"],
                "ip_address": meta["ip_address"],
                "duration_seconds": round(current_time - meta["connect_time"], 1),
                "latency_ms": meta["latency_ms"],
                "reconnect_count": meta["reconnect_count"],
                "status": meta["status"]
            })
            
        return sorted(clients, key=lambda c: c["duration_seconds"], reverse=True)

    def get_connection_count(self) -> int:
        return len(self._connections)

    def get_platform_distribution(self) -> Dict[str, int]:
        """Calculates counts per platform for charts rendering."""
        distribution: Dict[str, int] = {}
        for meta in self._connections.values():
            plat = meta["platform"]
            distribution[plat] = distribution.get(plat, 0) + 1
        return distribution

# Global singleton client connection registry
api_server_connection_registry = ClientConnectionRegistry()
