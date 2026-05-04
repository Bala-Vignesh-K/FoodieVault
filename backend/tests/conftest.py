import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://dishkeeper-1.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_token(api_client):
    """Request OTP, verify, return JWT token + user."""
    email = "TEST_pytest_user@foodievault.app"
    r = api_client.post(f"{BASE_URL}/api/auth/request-otp", json={"email": email}, timeout=15)
    assert r.status_code == 200, f"request-otp failed: {r.status_code} {r.text}"
    otp = r.json().get("dev_otp")
    assert otp, "dev_otp missing in response"
    r2 = api_client.post(f"{BASE_URL}/api/auth/verify-otp", json={"email": email, "otp": otp}, timeout=15)
    assert r2.status_code == 200, f"verify-otp failed: {r2.status_code} {r2.text}"
    data = r2.json()
    return {"token": data["token"], "user": data["user"], "email": email}


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token['token']}", "Content-Type": "application/json"}
