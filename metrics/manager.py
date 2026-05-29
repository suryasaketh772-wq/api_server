import time
import asyncio
import logging
from typing import Dict, Any
from metrics.collector import AppMetricsCollector
from websocket.analytics import api_server_connection_registry
from websocket.manager import api_server_client_ws_manager, api_server_admin_ws_manager

logger = logging.getLogger("api_server.metrics.manager")

class MetricsManager:
    """
    Centralised orchestrator compiling and broadcasting unified system telemetries.
    Combines application stats, psutil host configurations, and WebSocket analytics registries.
    """
    def __init__(self):
        self.app_collector = AppMetricsCollector()
        self._is_loop_running = False
        self._metrics_loop_task: Any = None
        self._server_start_time = time.time()

    def start_monitoring_loop(self) -> None:
        """Launches the background 1-second telemetry broadcasting loop."""
        if not self._is_loop_running:
            self._is_loop_running = True
            self._metrics_loop_task = asyncio.create_task(self._monitoring_loop())
            logger.info("Admin Metrics Telemetry Loop successfully started.")

    async def stop_monitoring_loop(self) -> None:
        """Gracefully terminates the metrics harvesting loops."""
        if self._is_loop_running:
            self._is_loop_running = False
            if self._metrics_loop_task:
                self._metrics_loop_task.cancel()
                try:
                    await self._metrics_loop_task
                except asyncio.CancelledError:
                    pass
            logger.info("Admin Metrics Telemetry Loop stopped.")

    async def _monitoring_loop(self) -> None:
        while self._is_loop_running:
            try:
                from backend.app.core.stream_state import STREAMING_ENABLED
                if STREAMING_ENABLED:
                    # Compile unified telemetry metrics payload
                    payload = await self.get_unified_metrics_payload()
                    
                    # Broadcast payload to all open admin WebSocket consoles
                    await api_server_admin_ws_manager.broadcast_payload(payload)
                
                # Sleep exactly 1.0 seconds for consistent chart rendering intervals
                await asyncio.sleep(1.0)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in metrics loop execution: {str(e)}", exc_info=True)
                await asyncio.sleep(2.0)

    async def get_unified_metrics_payload(self) -> Dict[str, Any]:
        """
        Gathers and aggregates stats across all active sub-systems.
        Constructs a clean JSON contract consumed by the Next.js Zustand stores.
        """
        # Dynamic import to avoid circular dependency trees
        from monitoring.system import get_system_metrics
        from backend.app.cache import price_cache

        # Get system statistics (CPU, RAM, Bandwidth, etc.)
        system_stats = get_system_metrics(self._server_start_time)
        
        # Calculate client WebSocket parameters
        active_sockets = api_server_connection_registry.get_connection_count()
        platforms_dict = api_server_connection_registry.get_platform_distribution()
        clients_list = api_server_connection_registry.get_all_clients()
        
        # Calculate rolling broadcasts speed
        broadcasts_per_sec = self.app_collector.calculate_broadcast_throughput(
            api_server_client_ws_manager.total_broadcasts_count
        )
        
        # Pull latest cache payload
        latest_price_obj = await price_cache.get_latest_price()
        latest_price_dict = latest_price_obj.model_dump() if latest_price_obj else {}
        
        # Assemble metrics sections
        api_metrics = self.app_collector.get_api_metrics()
        cache_metrics = self.app_collector.get_cache_metrics(latest_price_dict)
        
        # Build spot curves coordinates arrays matching dashboard charts
        spot_history = {
            "gold": list(self.app_collector.price_history_gold),
            "silver": list(self.app_collector.price_history_silver),
            "timestamps": list(self.app_collector.price_history_timestamps)
        }

        # Import global stream state dynamically
        from backend.app.core.stream_state import STREAMING_ENABLED

        return {
            "type": "telemetry",
            "timestamp": time.time(),
            "uptime_seconds": round(time.time() - self._server_start_time, 2),
            "streaming_enabled": STREAMING_ENABLED.enabled,
            "system": system_stats,
            "websocket": {
                "active_connections": active_sockets,
                "broadcasts_per_sec": broadcasts_per_sec,
                "total_broadcasts": api_server_client_ws_manager.total_broadcasts_count,
                "platform_distribution": platforms_dict,
                "clients": clients_list,
                "error_count": self.app_collector.error_count
            },
            "api": api_metrics,
            "cache": cache_metrics,
            "history": spot_history
        }

    async def broadcast_telemetry_immediately(self) -> None:
        """Immediately broadcasts the latest metrics payload to all active admin panels."""
        try:
            payload = await self.get_unified_metrics_payload()
            await api_server_admin_ws_manager.broadcast_payload(payload)
        except Exception as e:
            logger.error(f"Failed to broadcast telemetry immediately: {e}")

# Global singleton metrics manager instance
api_server_metrics_manager = MetricsManager()
