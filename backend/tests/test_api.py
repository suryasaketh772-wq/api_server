import pytest
import pytest_asyncio
import time
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.cache import price_cache
from backend.app.models import BullionPrice
from admin_api.auth import create_admin_jwt, verify_admin_credentials

client = TestClient(app)

@pytest_asyncio.fixture(loop_scope="function", autouse=True)
async def clear_cache():
    """Fixture to ensure the cache starts with consistent pricing test data."""
    test_price = BullionPrice(
        gold_spot=2350.00,
        silver_spot=30.80,
        usd_inr=83.45,
        gold_high=2360.00,
        gold_low=2340.00,
        silver_high=31.20,
        silver_low=30.00,
        timestamp=time.time()
    )
    await price_cache.set_latest_price(test_price)
    yield

# ============================================================================
# 1. PUBLIC CLIENT ROUTES CHECKS
# ============================================================================

@pytest.mark.asyncio(loop_scope="function")
async def test_health_endpoint():
    """Verifies that the public /health endpoint returns successfully."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "websocket_connections" in data
    assert "uptime_seconds" in data
    assert "mock_mode" in data

@pytest.mark.asyncio(loop_scope="function")
async def test_api_latest_endpoint():
    """Verifies that the REST backup /api/latest endpoint serves cached price fields."""
    response = client.get("/api/latest")
    assert response.status_code == 200
    data = response.json()
    assert data["gold_spot"] == 2350.00
    assert data["silver_spot"] == 30.80
    assert data["usd_inr"] == 83.45
    assert "timestamp" in data

# ============================================================================
# 2. ADMIN PANEL SECURITY & JWT AUTHENTICATION CHECKS
# ============================================================================

def test_admin_credentials_validation():
    """Validates the username and password checking behaviors."""
    # Matches defaults defined in settings/config.py
    assert verify_admin_credentials("admin", "admin123") is True
    assert verify_admin_credentials("admin", "wrongpassword") is False
    assert verify_admin_credentials("attacker", "admin123") is False

def test_admin_login_success():
    """Verifies that correct credentials yield valid, signed JWT session tokens."""
    payload = {"username": "admin", "password": "admin123"}
    response = client.post("/api/admin/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["username"] == "admin"

def test_admin_login_failure():
    """Verifies that incorrect credentials receive a strict 401 Unauthorised rejection."""
    payload = {"username": "admin", "password": "attackerpassword"}
    response = client.post("/api/admin/login", json=payload)
    assert response.status_code == 401
    assert "token" not in response.json()

@pytest.mark.asyncio(loop_scope="function")
async def test_admin_route_verification_valid_jwt():
    """Verifies that pages using GET /api/admin/verify validate matching Bearer JWTs."""
    token = create_admin_jwt("admin")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/admin/verify", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "valid"
    assert response.json()["username"] == "admin"

@pytest.mark.asyncio(loop_scope="function")
async def test_admin_route_verification_invalid_jwt():
    """Verifies that invalid or absent authorization headers are rejected."""
    headers = {"Authorization": "Bearer invalid_jwt_token_signature_string"}
    response = client.get("/api/admin/verify", headers=headers)
    assert response.status_code == 401

# ============================================================================
# 3. ADMIN SOCKET AUTHORIZATION BOUNDARIES CHECKS
# ============================================================================

def test_admin_websocket_unauthorized_missing_token():
    """Verifies that attempts to link to /ws/admin without JWT tokens are blocked instantly (1008 policy violation)."""
    with client.websocket_connect("/ws/admin") as websocket:
        # Since it is accepted and closed by the server, reading will trigger an exception
        with pytest.raises(Exception):
            websocket.receive_json()

def test_admin_websocket_unauthorized_bad_token():
    """Verifies that attempts to link to /ws/admin with invalid JWT tokens are blocked instantly."""
    with client.websocket_connect("/ws/admin?token=invalid_token") as websocket:
        with pytest.raises(Exception):
            websocket.receive_json()
