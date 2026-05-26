import asyncio
import time
from typing import Optional
from backend.app.models import BullionPrice

class PriceCache:
    """
    High-performance, async-safe in-memory cache for the latest bullion prices.
    Serves as the single-source-of-truth cache for REST backup API and active WebSockets.
    """
    def __init__(self):
        self._latest_price: Optional[BullionPrice] = None
        self._last_poll_timestamp: Optional[float] = None
        self._lock = asyncio.Lock()

    async def get_latest_price(self) -> Optional[BullionPrice]:
        async with self._lock:
            return self._latest_price

    async def set_latest_price(self, price: BullionPrice) -> None:
        async with self._lock:
            self._latest_price = price
            self._last_poll_timestamp = time.time()

    async def get_last_poll_timestamp(self) -> Optional[float]:
        async with self._lock:
            return self._last_poll_timestamp

# Global singleton cache instance
price_cache = PriceCache()
