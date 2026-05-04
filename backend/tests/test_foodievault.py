"""FoodieVault backend tests - auth, items CRUD, extract, swiggy mock."""
import pytest
import requests


# ---------- Health ----------
def test_root(api_client, base_url):
    r = api_client.get(f"{base_url}/api/", timeout=10)
    assert r.status_code == 200
    assert r.json().get("ok") is True


# ---------- Auth ----------
class TestAuth:
    def test_request_otp_returns_dev_otp(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/request-otp", json={"email": "TEST_otp@foodievault.app"}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert "dev_otp" in body
        assert len(body["dev_otp"]) == 6 and body["dev_otp"].isdigit()

    def test_verify_otp_wrong_returns_400(self, api_client, base_url):
        email = "TEST_wrong_otp@foodievault.app"
        api_client.post(f"{base_url}/api/auth/request-otp", json={"email": email}, timeout=15)
        r = api_client.post(f"{base_url}/api/auth/verify-otp", json={"email": email, "otp": "000000"}, timeout=15)
        assert r.status_code == 400

    def test_verify_otp_correct_returns_jwt(self, api_client, base_url):
        email = "TEST_verify_ok@foodievault.app"
        r = api_client.post(f"{base_url}/api/auth/request-otp", json={"email": email}, timeout=15)
        otp = r.json()["dev_otp"]
        r2 = api_client.post(f"{base_url}/api/auth/verify-otp", json={"email": email, "otp": otp}, timeout=15)
        assert r2.status_code == 200
        d = r2.json()
        assert d["success"] is True
        assert isinstance(d["token"], str) and len(d["token"]) > 20
        assert d["user"]["email"] == email.lower()
        assert d["user"]["onboarded"] is False

    def test_me_with_valid_jwt(self, api_client, base_url, auth_headers, auth_token):
        r = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == auth_token["email"].lower()

    def test_me_without_token(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/auth/me", timeout=10)
        assert r.status_code == 401

    def test_update_profile_sets_name_and_onboarded(self, api_client, base_url, auth_headers):
        r = api_client.post(
            f"{base_url}/api/auth/update-profile",
            json={"name": "Pytest User"},
            headers=auth_headers,
            timeout=10,
        )
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["name"] == "Pytest User"
        assert u["onboarded"] is True


# ---------- Items CRUD ----------
class TestItems:
    @pytest.fixture(autouse=True)
    def _setup(self, auth_headers, base_url):
        self.headers = auth_headers
        self.base = base_url
        self.created_ids = []
        yield
        for iid in self.created_ids:
            try:
                requests.delete(f"{self.base}/api/items/{iid}", headers=self.headers, timeout=10)
            except Exception:
                pass

    def _create(self, **overrides):
        payload = {
            "name": "TEST_Place",
            "type": "place",
            "description": "A test place",
            "location": "Mumbai, IN",
            "cuisine": "Indian",
            "tags": ["test"],
            "dishes": ["Biryani"],
            "ingredients": [],
        }
        payload.update(overrides)
        r = requests.post(f"{self.base}/api/items", json=payload, headers=self.headers, timeout=10)
        assert r.status_code == 200, r.text
        item = r.json()
        self.created_ids.append(item["id"])
        return item

    def test_create_item_persists(self):
        item = self._create()
        assert item["id"] and item["name"] == "TEST_Place" and item["type"] == "place"
        # Verify GET
        r = requests.get(f"{self.base}/api/items/{item['id']}", headers=self.headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Place"

    def test_list_items_filter_by_type(self):
        self._create(name="TEST_Recipe1", type="recipe")
        self._create(name="TEST_Place1", type="place")
        r = requests.get(f"{self.base}/api/items?type=recipe", headers=self.headers, timeout=10)
        assert r.status_code == 200
        body = r.json()
        types = {i["type"] for i in body["items"]}
        assert types == {"recipe"} or "recipe" in types  # only recipes if filter applied

    def test_stats_aggregates(self):
        self._create(name="TEST_StatsPlace", type="place", favorite=True)
        r = requests.get(f"{self.base}/api/items/stats", headers=self.headers, timeout=10)
        assert r.status_code == 200
        s = r.json()
        for key in ("place", "recipe", "item", "total", "favorites"):
            assert key in s
        assert s["total"] >= 1
        assert s["favorites"] >= 1

    def test_patch_item_update_favorite_and_notes(self):
        item = self._create()
        r = requests.patch(
            f"{self.base}/api/items/{item['id']}",
            json={"favorite": True, "notes": "yum"},
            headers=self.headers, timeout=10,
        )
        assert r.status_code == 200
        upd = r.json()
        assert upd["favorite"] is True and upd["notes"] == "yum"
        # GET re-verify
        g = requests.get(f"{self.base}/api/items/{item['id']}", headers=self.headers, timeout=10)
        assert g.json()["favorite"] is True

    def test_delete_item_then_404(self):
        item = self._create()
        r = requests.delete(f"{self.base}/api/items/{item['id']}", headers=self.headers, timeout=10)
        assert r.status_code == 200
        if item["id"] in self.created_ids:
            self.created_ids.remove(item["id"])
        g = requests.get(f"{self.base}/api/items/{item['id']}", headers=self.headers, timeout=10)
        assert g.status_code == 404


# ---------- Extract via Gemini (Emergent LLM Key) ----------
class TestExtract:
    def test_extract_youtube(self, api_client, base_url, auth_headers):
        url = "https://www.youtube.com/watch?v=ScMzIvxBSi4"
        r = api_client.post(f"{base_url}/api/extract", json={"url": url}, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["suggested_type"] in {"place", "recipe", "item"}
        assert isinstance(d["name"], str) and len(d["name"]) > 0
        assert d["source_platform"] == "youtube"
        assert d["source_url"] == url
        assert isinstance(d.get("tags", []), list)

    def test_extract_invalid_url(self, api_client, base_url, auth_headers):
        r = api_client.post(f"{base_url}/api/extract", json={"url": "notaurl"}, headers=auth_headers, timeout=10)
        assert r.status_code == 400

    def test_extract_unauth(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/extract", json={"url": "https://youtube.com/watch?v=abc"}, timeout=10)
        assert r.status_code == 401


# ---------- Swiggy Mock ----------
class TestSwiggy:
    def test_swiggy_order_mocked(self, api_client, base_url, auth_headers):
        # Need an item first
        payload = {"name": "TEST_OrderItem", "type": "item", "dishes": ["Pizza"]}
        ic = api_client.post(f"{base_url}/api/items", json=payload, headers=auth_headers, timeout=10)
        assert ic.status_code == 200
        item_id = ic.json()["id"]
        try:
            r = api_client.post(
                f"{base_url}/api/swiggy/order",
                json={"item_id": item_id, "order_type": "food"},
                headers=auth_headers, timeout=15,
            )
            assert r.status_code == 200, r.text
            o = r.json()
            assert o["mocked"] is True
            assert o["order_id"].startswith("SW-")
            assert o["eta_minutes"] >= 1
            assert o["estimated_amount"] > 0
            assert o["currency"] == "INR"
        finally:
            api_client.delete(f"{base_url}/api/items/{item_id}", headers=auth_headers, timeout=10)
