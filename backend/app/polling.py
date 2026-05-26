import asyncio
import time
import random
import logging
import aiohttp
from typing import Optional
from backend.app.config import settings
from backend.app.models import BullionPrice
from backend.app.cache import price_cache
from websocket.manager import api_server_client_ws_manager
from metrics.manager import api_server_metrics_manager

logger = logging.getLogger("api_server.polling")

class BullionPollingService:
    """
    High-availability polling service that pulls bullion prices every 2 seconds.
    Features robust connection pooling, automatic exponential backoff retry mechanisms,
    and reports round-trip response metrics and price feeds to the administrative telemetry managers.
    """
    def __init__(self):
        self.is_running = False
        self.polling_task: Optional[asyncio.Task] = None
        self.mock_mode = not settings.DPGOLD_API_URL
        
        # Stateful Mock Parameters (for local development or missing configuration)
        self._mock_gold = 2350.00
        self._mock_silver = 30.80
        self._mock_usd_inr = 83.45
        self._mock_gold_high = 2365.50
        self._mock_gold_low = 2335.20
        self._mock_silver_high = 31.40
        self._mock_silver_low = 30.10

    def start(self):
        """Starts the background polling task within the active event loop."""
        if not self.is_running:
            self.is_running = True
            self.polling_task = asyncio.create_task(self._polling_loop())
            logger.info("Bullion Pricing Poller Service initialized and started.")

    async def stop(self):
        """Signals the background polling loop to terminate and awaits its cleanup."""
        if self.is_running:
            self.is_running = False
            if self.polling_task:
                self.polling_task.cancel()
                try:
                    await self.polling_task
                except asyncio.CancelledError:
                    pass
            logger.info("Bullion Pricing Poller Service stopped.")

    async def _polling_loop(self):
        retry_delay = 1.0  # Initial recovery delay in seconds on error
        max_retry_delay = 30.0
        
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=5.0)
        ) as session:
            while self.is_running:
                try:
                    start_time = time.time()
                    
                    if self.mock_mode:
                        # Mock mode simulates sub-millisecond local processing speed
                        api_start = time.time()
                        price_data = self._generate_mock_price()
                        api_latency_ms = (time.time() - api_start) * 1000.0
                        
                        # Save stats
                        api_server_metrics_manager.app_collector.record_api_success(api_latency_ms)
                    else:
                        api_start = time.time()
                        try:
                            price_data = await self._fetch_from_api(session)
                            api_latency_ms = (time.time() - api_start) * 1000.0
                            
                            # Save latency stats on success
                            api_server_metrics_manager.app_collector.record_api_success(api_latency_ms)
                        except asyncio.TimeoutError:
                            # Record degraded timeout state
                            api_server_metrics_manager.app_collector.record_api_failure(degraded=True)
                            raise
                        except Exception:
                            # Record standard connection failure
                            api_server_metrics_manager.app_collector.record_api_failure(degraded=False)
                            raise
                    
                    # Update cache spots curves
                    api_server_metrics_manager.app_collector.record_price_snapshot(
                        price_data.gold_spot, 
                        price_data.silver_spot
                    )
                    
                    # Update local pricing state and trigger websocket broadcasts
                    await price_cache.set_latest_price(price_data)
                    
                    # Generate dual-compatibility JSON payload satisfying both the new Web clients
                    # and the existing Flutter app's expected payload formats.
                    import json
                    dual_payload = {
                        "gold_spot": price_data.gold_spot,
                        "silver_spot": price_data.silver_spot,
                        "usd_inr": price_data.usd_inr,
                        "gold_high": price_data.gold_high,
                        "gold_low": price_data.gold_low,
                        "silver_high": price_data.silver_high,
                        "silver_low": price_data.silver_low,
                        "timestamp": price_data.timestamp,
                        
                        # Existing Flutter app WebSocket payload contract
                        "type": "price_update",
                        "data": {
                            "gold": price_data.gold_spot,
                            "gold_high": price_data.gold_high,
                            "gold_low": price_data.gold_low,
                            "silver": price_data.silver_spot,
                            "silver_high": price_data.silver_high,
                            "silver_low": price_data.silver_low,
                            "usdinr": price_data.usd_inr
                        }
                    }
                    await api_server_client_ws_manager.broadcast(json.dumps(dual_payload))
                    
                    # Reset failure backoff delay on successful read
                    retry_delay = 1.0
                    
                    # Calculate execution drift and sleep exactly enough to align with the 2s interval
                    elapsed = time.time() - start_time
                    sleep_time = max(0.05, settings.POLL_INTERVAL_SECS - elapsed)
                    await asyncio.sleep(sleep_time)
                    
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Polling failure occurred: {str(e)}. Attempting reconnection in {retry_delay}s...")
                    api_server_metrics_manager.app_collector.record_error()
                    await asyncio.sleep(retry_delay)
                    # Exponential backoff retry logic up to max limit
                    retry_delay = min(max_retry_delay, retry_delay * 2)

    async def _fetch_from_api(self, session: aiohttp.ClientSession) -> BullionPrice:
        """
        Fetches live precious metal rates from the dpgold.in Tab-Separated streaming API.
        Parses rows dynamically based on Symbol IDs and Names to resolve spots, highs, lows, and exchange indexes.
        """
        headers = {}
        if settings.DPGOLD_API_KEY:
            headers["Authorization"] = f"Bearer {settings.DPGOLD_API_KEY}"
            
        async with session.get(settings.DPGOLD_API_URL, headers=headers) as response:
            if response.status != 200:
                body = await response.text()
                raise Exception(f"HTTP code {response.status} from DPGold streaming API: {body}")
            
            text = await response.text()
            lines = text.strip().split("\n")
            
            gold_spot, gold_high, gold_low = 0.0, 0.0, 0.0
            silver_spot, silver_high, silver_low = 0.0, 0.0, 0.0
            usd_inr = 83.45 # standard default rate fallback
            
            for line in lines:
                parts = line.strip().split("\t")
                if len(parts) >= 6:
                    symbol_id = parts[0].strip()
                    symbol_name = parts[1].strip().upper()
                    
                    try:
                        bid = float(parts[2])
                        ask = float(parts[3])
                        high = float(parts[4])
                        low = float(parts[5])
                        
                        # Match Symbol 235 (GOLD SPOT) or search string
                        if symbol_id == "235" or "GOLD SPOT" in symbol_name:
                            gold_spot = ask
                            gold_high = high
                            gold_low = low
                        
                        # Match Symbol 236 (SILVER SPOT) or search string
                        elif symbol_id == "236" or "SILVER SPOT" in symbol_name:
                            silver_spot = ask
                            silver_high = high
                            silver_low = low
                            
                        # Match Symbol 237 (USDINR) or search string
                        elif symbol_id == "237" or "USDINR" in symbol_name:
                            usd_inr = ask
                    except ValueError:
                        # Skip corrupted rows to ensure other rates parse successfully
                        logger.warning(f"Skip row: Failed numeric conversions on columns: {line}")
                        continue
            
            if gold_spot <= 0.0 or silver_spot <= 0.0:
                raise ValueError("Parsed spots cannot be less than or equal to zero")

            return BullionPrice(
                gold_spot=gold_spot,
                silver_spot=silver_spot,
                usd_inr=usd_inr,
                gold_high=gold_high,
                gold_low=gold_low,
                silver_high=silver_high,
                silver_low=silver_low,
                timestamp=time.time()
            )

    def _generate_mock_price(self) -> BullionPrice:
        """Generates realistic micro-fluctuations (0.01% - 0.15%) to emulate live trade flows."""
        # Random micro adjustments with slight positive drift bias
        gold_drift = random.uniform(-0.15, 0.18)
        silver_drift = random.uniform(-0.005, 0.006)
        usd_inr_drift = random.uniform(-0.02, 0.02)
        
        self._mock_gold = round(max(100.0, self._mock_gold + gold_drift), 2)
        self._mock_silver = round(max(5.0, self._mock_silver + silver_drift), 2)
        self._mock_usd_inr = round(max(50.0, self._mock_usd_inr + usd_inr_drift), 2)
        
        # Track session highs and lows
        if self._mock_gold > self._mock_gold_high:
            self._mock_gold_high = self._mock_gold
        if self._mock_gold < self._mock_gold_low:
            self._mock_gold_low = self._mock_gold
            
        if self._mock_silver > self._mock_silver_high:
            self._mock_silver_high = self._mock_silver
        if self._mock_silver < self._mock_silver_low:
            self._mock_silver_low = self._mock_silver

        # Periodically simulate a slight reset to highs/lows (like a new trading day)
        if random.random() < 0.001:  # ~0.1% chance per loop cycle
            self._mock_gold_high = self._mock_gold + random.uniform(1.0, 5.0)
            self._mock_gold_low = self._mock_gold - random.uniform(1.0, 5.0)
            self._mock_silver_high = self._mock_silver + random.uniform(0.1, 0.5)
            self._mock_silver_low = self._mock_silver - random.uniform(0.1, 0.5)

        return BullionPrice(
            gold_spot=self._mock_gold,
            silver_spot=self._mock_silver,
            usd_inr=self._mock_usd_inr,
            gold_high=round(self._mock_gold_high, 2),
            gold_low=round(self._mock_gold_low, 2),
            silver_high=round(self._mock_silver_high, 2),
            silver_low=round(self._mock_silver_low, 2),
            timestamp=time.time()
        )

# Global singleton poller instance
bullion_polling_service = BullionPollingService()
