import time
import logging
from collections import deque
from typing import Dict, Any, List
from backend.app.config import settings

logger = logging.getLogger("api_server.metrics.collector")

class AppMetricsCollector:
    """
    Stateful metrics collector tracking application runtime details.
    Captures live data streams, failure rates, cache statistics, and API performance.
    """
    def __init__(self):
        # Latency records queue (stores last 30 measurements)
        self.latency_history: deque = deque(maxlen=30)
        
        # Core Counters
        self.error_count = 0
        self.api_success_count = 0
        self.api_failure_count = 0
        
        # Telemetries
        self.dpgold_status = "online" # online / offline / degraded
        self.latest_api_latency_ms = 0.0
        
        # Cache variables
        self.last_poll_success = 0.0
        self.cache_refresh_interval = 2.0
        
        # Historical prices registry (stores last 30 intervals to draw live chart vectors)
        self.price_history_gold: deque = deque(maxlen=30)
        self.price_history_silver: deque = deque(maxlen=30)
        self.price_history_timestamps: deque = deque(maxlen=30)

        # Broadcast telemetry calculators
        self._prev_broadcast_count = 0
        self.current_broadcasts_per_sec = 0
        self._last_calc_time = time.time()

    def record_api_success(self, latency_ms: float) -> None:
        """Logs a successful DPGold API call, tracking latencies and timestamps."""
        self.latest_api_latency_ms = round(latency_ms, 1)
        self.latency_history.append(self.latest_api_latency_ms)
        self.dpgold_status = "online"
        self.api_success_count += 1
        self.last_poll_success = time.time()

    def record_api_failure(self, degraded: bool = False) -> None:
        """Logs an API failure, flagging status indicators dynamically."""
        self.api_failure_count += 1
        self.error_count += 1
        self.dpgold_status = "degraded" if degraded else "offline"
        self.latency_history.append(0.0) # 0.0 represents connection outage in graphs

    def record_error(self) -> None:
        self.error_count += 1

    def record_price_snapshot(self, gold: float, silver: float) -> None:
        """Appends recent spots to local history for chart ingestion."""
        self.price_history_gold.append(gold)
        self.price_history_silver.append(silver)
        self.price_history_timestamps.append(time.time())

    def calculate_broadcast_throughput(self, current_total: int) -> float:
        """Computes rolling broadcasts/sec by measuring increment speeds over epoch bounds."""
        now = time.time()
        elapsed = now - self._last_calc_time
        
        if elapsed >= 0.9: # Trigger calc every ~1.0 second
            diff = max(0, current_total - self._prev_broadcast_count)
            self.current_broadcasts_per_sec = round(diff / elapsed, 1)
            self._prev_broadcast_count = current_total
            self._last_calc_time = now
            
        return self.current_broadcasts_per_sec

    def get_api_metrics(self) -> Dict[str, Any]:
        """Formats API telemetry logs for monitoring views."""
        success_ratio = 100.0
        total_calls = self.api_success_count + self.api_failure_count
        if total_calls > 0:
            success_ratio = round((self.api_success_count / total_calls) * 100, 1)

        avg_latency = 0.0
        if self.latency_history:
            valid_latencies = [l for l in self.latency_history if l > 0]
            if valid_latencies:
                avg_latency = round(sum(valid_latencies) / len(valid_latencies), 1)

        return {
            "status": self.dpgold_status,
            "latest_latency_ms": self.latest_api_latency_ms,
            "average_latency_ms": avg_latency,
            "latency_history": list(self.latency_history),
            "total_requests": total_calls,
            "successful_requests": self.api_success_count,
            "failed_requests": self.api_failure_count,
            "success_rate_percent": success_ratio,
            "last_success_timestamp": self.last_poll_success
        }

    def get_cache_metrics(self, cache_payload: Dict[str, Any]) -> Dict[str, Any]:
        """Resolves cache diagnostics including age indicators and size footprints."""
        age = 0.0
        if self.last_poll_success > 0:
            age = round(time.time() - self.last_poll_success, 1)
            
        import sys
        # Estimate size of cached python dictionary in memory
        payload_bytes = sys.getsizeof(cache_payload)
        
        return {
            "latest_payload": cache_payload,
            "cache_age_seconds": age,
            "estimated_size_bytes": payload_bytes,
            "refresh_interval_seconds": settings.POLL_INTERVAL_SECS,
            "status": "fresh" if age <= settings.POLL_INTERVAL_SECS * 1.5 else "stale"
        }
