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
        # Maps client_id (str) -> metadata dicts
        self._clients: Dict[str, Dict[str, Any]] = {}
        # Grace timers map: client_id -> asyncio.Task for transitioning to OFFLINE
        self._grace_timers: Dict[str, Any] = {}

    def register(self, websocket: WebSocket, user_agent: str, ip_address: str) -> str:
        """Registers or re-registers a client connection using persistent client_id."""
        # 1. Parse client_id and platform from query parameters
        client_id = websocket.query_params.get("client_id")
        platform_param = websocket.query_params.get("platform")

        # Parse platform profile cleanly from parameters or User-Agent
        platform = "Unknown Web"
        if platform_param == "web":
            platform = "WEB APP"
        else:
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

        if not client_id:
            # Check if there is an existing client in registry with the exact same IP and platform to prevent duplicates
            for existing_id, existing_meta in self._clients.items():
                if existing_meta["ip_address"] == ip_address and existing_meta["platform"] == platform:
                    client_id = existing_id
                    logger.info(f"Reconnecting duplicate: Reusing client_id {client_id} for same IP {ip_address} and platform {platform}")
                    break

        if not client_id:
            # Fallback to generating a unique client ID if not supplied and no existing match found
            client_id = f"cli_{uuid.uuid4().hex[:8]}"

        # Cancel any pending offline grace transition timer if client reconnects
        if client_id in self._grace_timers:
            task = self._grace_timers.pop(client_id)
            try:
                task.cancel()
            except Exception:
                pass

        current_time = time.time()

        if client_id in self._clients:
            # Existing client reconnecting: update the entry
            meta = self._clients[client_id]
            meta["websocket"] = websocket
            meta["ip_address"] = ip_address
            meta["platform"] = platform
            meta["connected_at"] = current_time
            meta["disconnected_at"] = None
            meta["reconnect_count"] += 1
            meta["connection_state"] = "ONLINE"
            meta["status"] = "ONLINE"
            meta["last_ping"] = current_time
            logger.info(f"Re-registered connection {client_id} [{platform}] from {ip_address} (reconnect count: {meta['reconnect_count']})")
        else:
            # New client connecting
            meta = {
                "client_id": client_id,
                "websocket": websocket,
                "ip_address": ip_address,
                "platform": platform,
                "connected_at": current_time,
                "disconnected_at": None,
                "last_ping": current_time,
                "reconnect_count": 0,
                "latency_ms": 0.0,
                "connection_state": "ONLINE",
                "status": "ONLINE"
            }
            self._clients[client_id] = meta
            logger.info(f"Registered brand new connection {client_id} [{platform}] from {ip_address}")

        return client_id

    def deregister(self, websocket: WebSocket, is_clean: bool = True) -> None:
        """Handles socket disconnect, marking clients as OFFLINE instantly."""
        # Find the client_id associated with this websocket object
        client_id = None
        for cid, meta in self._clients.items():
            if meta["websocket"] == websocket:
                client_id = cid
                break

        if not client_id:
            return

        meta = self._clients[client_id]
        meta["websocket"] = None
        meta["disconnected_at"] = time.time()

        # Mark connection as OFFLINE immediately on any disconnect
        meta["connection_state"] = "OFFLINE"
        meta["status"] = "OFFLINE"
        logger.info(f"Disconnection for connection {client_id}. Marked OFFLINE instantly.")

    def update_latency(self, websocket: WebSocket, latency_ms: float) -> None:
        """Updates connection latency metadata based on ping/pong feedback loops."""
        for meta in self._clients.values():
            if meta["websocket"] == websocket:
                meta["latency_ms"] = round(latency_ms, 1)
                break

    def get_all_clients(self) -> List[Dict[str, Any]]:
        """Formats registry details into serialized lists for admin dashboard ingestion."""
        current_time = time.time()
        clients = []
        
        # Build copy snapshot to prevent modification errors during iteration
        for client_id, meta in list(self._clients.items()):
            conn_time = meta["connected_at"]
            disc_time = meta["disconnected_at"]
            
            # Active duration calculation:
            # If online, duration is relative to current_time.
            # If offline, duration is fixed relative to when it disconnected.
            if meta["connection_state"] == "ONLINE":
                duration = round(current_time - conn_time, 1)
            else:
                duration = round((disc_time or current_time) - conn_time, 1)

            clients.append({
                "client_id": meta["client_id"],
                "platform": meta["platform"],
                "ip_address": meta["ip_address"],
                "duration_seconds": max(0.0, duration),
                "latency_ms": meta["latency_ms"],
                "reconnect_count": meta["reconnect_count"],
                "status": meta["connection_state"],
                "connection_state": meta["connection_state"]
            })
            
        return sorted(clients, key=lambda c: c["duration_seconds"], reverse=True)

    def get_connection_count(self) -> int:
        """Returns the number of active (ONLINE) connections."""
        return sum(1 for c in self._clients.values() if c["connection_state"] == "ONLINE")

    def get_platform_distribution(self) -> Dict[str, int]:
        """Calculates counts per platform for charts rendering."""
        distribution: Dict[str, int] = {}
        for meta in self._clients.values():
            # Only count active/online clients in platform charts
            if meta["connection_state"] == "ONLINE":
                plat = meta["platform"]
                distribution[plat] = distribution.get(plat, 0) + 1
        return distribution

    def cleanup_stale_clients(self, expiration_seconds: float = 300.0) -> None:
        """Removes offline clients that have been inactive past the expiration threshold."""
        current_time = time.time()
        stale_ids = []
        for client_id, meta in list(self._clients.items()):
            if meta["connection_state"] == "OFFLINE":
                disc_time = meta["disconnected_at"]
                if disc_time and (current_time - disc_time) > expiration_seconds:
                    stale_ids.append(client_id)
        
        for cid in stale_ids:
            self._clients.pop(cid, None)
            self._grace_timers.pop(cid, None)
            logger.info(f"Garbage collected stale offline client registry record: {cid}")

# Global singleton client connection registry
api_server_connection_registry = ClientConnectionRegistry()
