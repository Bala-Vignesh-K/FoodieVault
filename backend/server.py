"""FoodieVault Backend - Save places, recipes & items from social media shares."""
import os
import re
import uuid
import random
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal

import jwt
import httpx
from bs4 import BeautifulSoup
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel, Field, EmailStr

from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---------- Configuration ----------
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_EXPIRY_DAYS = int(os.environ.get('JWT_EXPIRY_DAYS', 30))
OTP_EXPIRY_MINUTES = int(os.environ.get('OTP_EXPIRY_MINUTES', 10))

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="FoodieVault API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("foodievault")


# ---------- Models ----------
ContentType = Literal["place", "recipe", "item"]
SourcePlatform = Literal["instagram", "youtube", "tiktok", "other"]


class OTPRequest(BaseModel):
    email: EmailStr


class OTPVerify(BaseModel):
    email: EmailStr
    otp: str


class ProfileUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)


class User(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    created_at: str
    onboarded: bool = False


class ExtractRequest(BaseModel):
    url: str


class ExtractedContent(BaseModel):
    suggested_type: ContentType
    name: str
    description: str
    location: Optional[str] = None
    cuisine: Optional[str] = None
    ingredients: List[str] = []
    dishes: List[str] = []
    source_platform: SourcePlatform
    source_url: str
    thumbnail_url: Optional[str] = None
    tags: List[str] = []


class SavedItemBase(BaseModel):
    name: str
    type: ContentType
    description: Optional[str] = None
    location: Optional[str] = None
    cuisine: Optional[str] = None
    ingredients: List[str] = []
    dishes: List[str] = []
    source_platform: Optional[SourcePlatform] = "other"
    source_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    tags: List[str] = []
    notes: Optional[str] = None
    favorite: bool = False


class SavedItemCreate(SavedItemBase):
    pass


class SavedItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    cuisine: Optional[str] = None
    ingredients: Optional[List[str]] = None
    dishes: Optional[List[str]] = None
    notes: Optional[str] = None
    favorite: Optional[bool] = None
    tags: Optional[List[str]] = None


class SavedItem(SavedItemBase):
    id: str
    user_id: str
    created_at: str
    updated_at: str


class SwiggyOrderRequest(BaseModel):
    item_id: str
    order_type: Literal["food", "ingredients"]


# ---------- Helpers ----------
def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing auth token")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
        user_id = payload["sub"]
    except jwt.PyJWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {e}")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


def detect_platform(url: str) -> SourcePlatform:
    u = url.lower()
    if "instagram.com" in u:
        return "instagram"
    if "youtube.com" in u or "youtu.be" in u:
        return "youtube"
    if "tiktok.com" in u:
        return "tiktok"
    return "other"


async def fetch_page_metadata(url: str) -> dict:
    """Fetch OpenGraph metadata from a URL."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        )
    }
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers=headers) as hc:
            r = await hc.get(url)
            html = r.text
    except Exception as e:
        logger.warning(f"Failed fetch {url}: {e}")
        return {"title": "", "description": "", "thumbnail": "", "raw_text": ""}

    soup = BeautifulSoup(html, "lxml")

    def meta(prop: str) -> str:
        tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
        return (tag.get("content") if tag else "") or ""

    title = meta("og:title") or (soup.title.string if soup.title else "") or ""
    description = meta("og:description") or meta("description") or ""
    thumb = meta("og:image") or meta("twitter:image") or ""

    # For YouTube - try to extract video title & description from script tags
    extra = ""
    if "youtube.com" in url or "youtu.be" in url:
        # Grab more from JSON-LD or itemprop
        video_desc = soup.find("meta", attrs={"itemprop": "description"})
        if video_desc:
            extra += " " + (video_desc.get("content") or "")

    return {
        "title": title.strip()[:500],
        "description": (description + " " + extra).strip()[:2000],
        "thumbnail": thumb,
        "raw_text": "",
    }


EXTRACTION_SYSTEM = """You are a smart content analyzer for a food discovery app called FoodieVault.
Users share social media posts (Instagram/YouTube/TikTok) about food experiences. Your job: extract structured info.

Classify the content as exactly ONE of:
- "place" : A restaurant, cafe, bar, or food location user wants to visit
- "recipe": A cookable recipe with ingredients/instructions
- "item"  : A specific dish/food item to order from a restaurant

Return ONLY a single minified JSON object (no markdown, no code fences) with these exact keys:
{
  "suggested_type": "place" | "recipe" | "item",
  "name": "Short clear title (max 60 chars)",
  "description": "1-2 sentence description (max 200 chars)",
  "location": "City, Country if mentioned, else null",
  "cuisine": "e.g. Italian, Indian, Japanese - else null",
  "ingredients": ["ingredient1", ...] (only if recipe, else []),
  "dishes": ["dish1", ...] (specific dishes mentioned, else []),
  "tags": ["tag1", "tag2", ...] (3-5 relevant keywords)
}

Rules:
- If place + dishes mentioned: use "place" and list dishes in dishes[]
- If it's a cooking tutorial/recipe: use "recipe"
- If it's a specific takeaway food item: use "item"
- Keep names punchy and clean
- Never include hashtags or @mentions in the name
"""


async def extract_with_ai(metadata: dict, url: str, platform: SourcePlatform) -> dict:
    """Use Gemini via Emergent LLM key to extract structured data."""
    source_blob = f"""PLATFORM: {platform}
URL: {url}
TITLE: {metadata.get('title', '')}
DESCRIPTION: {metadata.get('description', '')}
"""
    session_id = f"extract-{uuid.uuid4()}"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=EXTRACTION_SYSTEM,
    ).with_model("gemini", "gemini-2.5-pro")

    msg = UserMessage(text=source_blob)
    try:
        response = await chat.send_message(msg)
    except Exception as e:
        logger.error(f"AI extraction failed: {e}")
        return {
            "suggested_type": "place",
            "name": metadata.get("title", "Untitled")[:60] or "Untitled",
            "description": metadata.get("description", "")[:200],
            "location": None,
            "cuisine": None,
            "ingredients": [],
            "dishes": [],
            "tags": [],
        }

    # Parse JSON from AI output
    import json as _json
    txt = str(response).strip()
    # Strip markdown fences if any
    txt = re.sub(r"^```(?:json)?", "", txt).strip()
    txt = re.sub(r"```$", "", txt).strip()
    try:
        data = _json.loads(txt)
    except Exception:
        match = re.search(r"\{.*\}", txt, re.DOTALL)
        if match:
            try:
                data = _json.loads(match.group(0))
            except Exception:
                data = {}
        else:
            data = {}

    # Safe defaults + normalize
    return {
        "suggested_type": data.get("suggested_type", "place") if data.get("suggested_type") in {"place", "recipe", "item"} else "place",
        "name": str(data.get("name") or metadata.get("title") or "Untitled")[:80],
        "description": str(data.get("description") or "")[:300],
        "location": data.get("location") or None,
        "cuisine": data.get("cuisine") or None,
        "ingredients": list(data.get("ingredients") or [])[:30],
        "dishes": list(data.get("dishes") or [])[:20],
        "tags": list(data.get("tags") or [])[:8],
    }


# ---------- Routes: Auth ----------
@api.get("/")
async def root():
    return {"message": "FoodieVault API", "ok": True}


@api.post("/auth/request-otp")
async def request_otp(payload: OTPRequest):
    """Generate 6-digit OTP. In MVP mode, returns the OTP in `dev_otp` for testing.
    Swap with SendGrid/SMTP/Firebase email in production."""
    email = payload.email.lower().strip()
    otp = f"{random.randint(100000, 999999)}"
    expires = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)

    await db.otps.update_one(
        {"email": email},
        {"$set": {
            "email": email,
            "otp": otp,
            "expires_at": expires.isoformat(),
            "attempts": 0,
            "created_at": iso_now(),
        }},
        upsert=True,
    )
    logger.info(f"[OTP] {email} -> {otp} (expires {expires.isoformat()})")
    # NOTE: dev_otp is returned so the user can see the code during MVP testing.
    # Remove once email-sending (SendGrid / Firebase) is configured.
    return {"success": True, "message": "OTP sent", "dev_otp": otp}


@api.post("/auth/verify-otp")
async def verify_otp(payload: OTPVerify):
    email = payload.email.lower().strip()
    record = await db.otps.find_one({"email": email}, {"_id": 0})
    if not record:
        raise HTTPException(400, "No OTP request found. Request a new code.")
    if record.get("attempts", 0) >= 5:
        raise HTTPException(429, "Too many attempts. Request a new code.")
    expires_at = datetime.fromisoformat(record["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(400, "OTP expired. Request a new code.")
    if record["otp"] != payload.otp.strip():
        await db.otps.update_one({"email": email}, {"$inc": {"attempts": 1}})
        raise HTTPException(400, "Incorrect code")

    # Success → delete OTP, upsert user
    await db.otps.delete_one({"email": email})
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": None,
            "onboarded": False,
            "created_at": iso_now(),
        }
        await db.users.insert_one(user.copy())
        user.pop("_id", None)

    token = make_token(user["id"])
    return {"success": True, "token": token, "user": user}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": user}


@api.post("/auth/update-profile")
async def update_profile(payload: ProfileUpdate, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"name": payload.name.strip(), "onboarded": True, "updated_at": iso_now()}},
    )
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"user": updated}


# ---------- Routes: Extraction ----------
@api.post("/extract")
async def extract_from_url(payload: ExtractRequest, user: dict = Depends(get_current_user)):
    url = payload.url.strip()
    if not re.match(r"^https?://", url):
        raise HTTPException(400, "Invalid URL")

    platform = detect_platform(url)
    metadata = await fetch_page_metadata(url)
    ai_data = await extract_with_ai(metadata, url, platform)

    result = {
        **ai_data,
        "source_platform": platform,
        "source_url": url,
        "thumbnail_url": metadata.get("thumbnail") or None,
    }
    return result


# ---------- Routes: Saved Items (Places, Recipes, Items) ----------
@api.post("/items")
async def create_item(payload: SavedItemCreate, user: dict = Depends(get_current_user)):
    item = payload.dict()
    item.update({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "created_at": iso_now(),
        "updated_at": iso_now(),
    })
    await db.items.insert_one(item.copy())
    item.pop("_id", None)
    return item


@api.get("/items")
async def list_items(
    type: Optional[ContentType] = None,
    favorite: Optional[bool] = None,
    user: dict = Depends(get_current_user),
):
    query = {"user_id": user["id"]}
    if type:
        query["type"] = type
    if favorite is not None:
        query["favorite"] = favorite
    items = await db.items.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"items": items, "count": len(items)}


@api.get("/items/stats")
async def items_stats(user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": user["id"]}},
        {"$group": {"_id": "$type", "count": {"$sum": 1}}},
    ]
    cursor = db.items.aggregate(pipeline)
    stats = {"place": 0, "recipe": 0, "item": 0, "total": 0, "favorites": 0}
    async for row in cursor:
        t = row["_id"]
        if t in stats:
            stats[t] = row["count"]
            stats["total"] += row["count"]
    stats["favorites"] = await db.items.count_documents({"user_id": user["id"], "favorite": True})
    return stats


@api.get("/items/{item_id}")
async def get_item(item_id: str, user: dict = Depends(get_current_user)):
    item = await db.items.find_one({"id": item_id, "user_id": user["id"]}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Not found")
    return item


@api.patch("/items/{item_id}")
async def update_item(item_id: str, payload: SavedItemUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No updates provided")
    updates["updated_at"] = iso_now()
    result = await db.items.update_one(
        {"id": item_id, "user_id": user["id"]}, {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Not found")
    item = await db.items.find_one({"id": item_id, "user_id": user["id"]}, {"_id": 0})
    return item


@api.delete("/items/{item_id}")
async def delete_item(item_id: str, user: dict = Depends(get_current_user)):
    result = await db.items.delete_one({"id": item_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"success": True}


# ---------- Routes: Swiggy (MOCKED) ----------
@api.post("/swiggy/order")
async def swiggy_order(payload: SwiggyOrderRequest, user: dict = Depends(get_current_user)):
    """MOCKED Swiggy order. Replace with real Swiggy MCP integration after approval at mcp.swiggy.com/builders."""
    item = await db.items.find_one({"id": payload.item_id, "user_id": user["id"]}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Item not found")

    await asyncio.sleep(0.8)  # simulate API latency
    mock_order_id = f"SW-{uuid.uuid4().hex[:8].upper()}"
    eta_minutes = random.randint(25, 55)
    estimated_amount = random.randint(180, 780)

    order = {
        "order_id": mock_order_id,
        "status": "placed",
        "item_name": item["name"],
        "order_type": payload.order_type,
        "eta_minutes": eta_minutes,
        "estimated_amount": estimated_amount,
        "currency": "INR",
        "placed_at": iso_now(),
        "mocked": True,
        "swiggy_url": f"https://www.swiggy.com/order/{mock_order_id}",
    }
    await db.orders.insert_one({**order, "user_id": user["id"]})
    return order


@api.get("/swiggy/orders")
async def list_orders(user: dict = Depends(get_current_user)):
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("placed_at", -1).to_list(100)
    return {"orders": orders}


# ---------- Mount ----------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
