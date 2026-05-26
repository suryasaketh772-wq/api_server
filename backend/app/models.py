from pydantic import BaseModel, Field
from typing import Optional

class BullionPrice(BaseModel):
    gold_spot: float = Field(..., description="Spot gold price per ounce in USD")
    silver_spot: float = Field(..., description="Spot silver price per ounce in USD")
    usd_inr: float = Field(..., description="USD to INR currency exchange rate")
    gold_high: float = Field(..., description="Highest gold price recorded today")
    gold_low: float = Field(..., description="Lowest gold price recorded today")
    silver_high: float = Field(..., description="Highest silver price recorded today")
    silver_low: float = Field(..., description="Lowest silver price recorded today")
    timestamp: float = Field(..., description="Epoch timestamp of when the price was fetched/calculated")

class HealthStatus(BaseModel):
    status: str = Field("healthy", description="Overall health state of the server")
    websocket_connections: int = Field(0, description="Active client WebSocket connections")
    polling_active: bool = Field(True, description="Indicates if the background polling loop is running")
    uptime_seconds: float = Field(..., description="Uptime of the server in seconds")
    mock_mode: bool = Field(..., description="True if the poller is using generated fallback prices, False if using production DPGold API")
    last_poll_timestamp: Optional[float] = Field(None, description="Epoch timestamp of the last successful price retrieval")
