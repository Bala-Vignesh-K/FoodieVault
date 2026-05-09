"""FoodieVault Backend - Save places, recipes & items from social media shares."""
import os
import re
import uuid
import json
import random
import hashlib
import logging
import asyncio
import tempfile
import subprocess
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

# Transcript-related configuration
TRANSCRIPT_MAX_CHARS = int(os.environ.get("TRANSCRIPT_MAX_CHARS", 18000))
WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "small")
WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")

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


# ---------- Transcript Helpers ----------
def normalize_source_url(url: str) -> str:
    """Create a stable URL key for transcript caching."""
    return url.strip().split("#", 1)[0]


def transcript_cache_key(url: str) -> str:
    normalized = normalize_source_url(url)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def sanitize_transcript_text(text: str) -> str:
    """Collapse whitespace and keep transcript within the LLM context budget."""
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    return cleaned[:TRANSCRIPT_MAX_CHARS]


async def run_command(command: List[str], timeout_seconds: int = 120) -> subprocess.CompletedProcess:
    """Run a blocking shell command in a worker thread so FastAPI's event loop is not blocked."""
    def _run() -> subprocess.CompletedProcess:
        return subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )

    return await asyncio.to_thread(_run)


async def get_cached_transcript(url: str) -> Optional[dict]:
    key = transcript_cache_key(url)
    cached = await db.transcripts.find_one({"cache_key": key}, {"_id": 0})
    return cached


async def save_cached_transcript(url: str, platform: SourcePlatform, transcript: str, method: str) -> dict:
    key = transcript_cache_key(url)
    record = {
        "cache_key": key,
        "source_url": normalize_source_url(url),
        "source_platform": platform,
        "transcript": sanitize_transcript_text(transcript),
        "method": method,
        "created_at": iso_now(),
        "updated_at": iso_now(),
    }
    await db.transcripts.update_one(
        {"cache_key": key},
        {"$set": record},
        upsert=True,
    )
    return record


async def fetch_youtube_transcript_api(url: str) -> Optional[str]:
    """Try fetching YouTube captions using youtube-transcript-api."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except Exception as e:
        logger.info(f"youtube-transcript-api unavailable: {e}")
        return None

    video_id = extract_youtube_video_id(url)
    if not video_id:
        return None

    def _fetch() -> Optional[str]:
        try:
            transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=["en"])
        except Exception:
            try:
                transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
                transcript_obj = None
                for candidate in transcript_list:
                    transcript_obj = candidate
                    if getattr(candidate, "language_code", "").startswith("en"):
                        break
                if not transcript_obj:
                    return None
                transcript = transcript_obj.fetch()
            except Exception:
                return None

        lines = []
        for row in transcript:
            text = row.get("text", "") if isinstance(row, dict) else ""
            if text:
                lines.append(text)
        return " ".join(lines).strip() or None

    return await asyncio.to_thread(_fetch)


def extract_youtube_video_id(url: str) -> Optional[str]:
    patterns = [
        r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)([A-Za-z0-9_-]{6,})",
        r"youtube\.com/embed/([A-Za-z0-9_-]{6,})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


async def fetch_ytdlp_captions(url: str, workdir: Path) -> Optional[str]:
    """Try downloading captions/subtitles using yt-dlp."""
    output_template = str(workdir / "captions.%(ext)s")
    command = [
        "yt-dlp",
        "--skip-download",
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs",
        "en.*",
        "--sub-format",
        "vtt/srv3/ttml/best",
        "-o",
        output_template,
        url,
    ]
    result = await run_command(command, timeout_seconds=120)
    if result.returncode != 0:
        logger.info(f"yt-dlp captions failed for {url}: {result.stderr[:500]}")
        return None

    caption_files = list(workdir.glob("captions*.vtt")) + list(workdir.glob("captions*.srv3")) + list(workdir.glob("captions*.ttml"))
    if not caption_files:
        return None

    raw = caption_files[0].read_text(encoding="utf-8", errors="ignore")
    return parse_caption_text(raw)


def parse_caption_text(raw: str) -> Optional[str]:
    """Parse common subtitle formats into plain text."""
    if not raw:
        return None

    lines = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.upper().startswith("WEBVTT"):
            continue
        if "-->" in line:
            continue
        if re.match(r"^\d+$", line):
            continue
        line = re.sub(r"<[^>]+>", "", line)
        line = re.sub(r"&amp;", "&", line)
        line = re.sub(r"&lt;", "<", line)
        line = re.sub(r"&gt;", ">", line)
        if line:
            lines.append(line)

    text = " ".join(lines).strip()
    return text or None


async def extract_audio_with_ytdlp(url: str, workdir: Path) -> Optional[Path]:
    """Use yt-dlp to download/extract audio from YouTube or Instagram."""
    output_template = str(workdir / "source_audio.%(ext)s")
    command = [
        "yt-dlp",
        "-f",
        "bestaudio/best",
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "-o",
        output_template,
        url,
    ]
    result = await run_command(command, timeout_seconds=240)
    if result.returncode != 0:
        logger.info(f"yt-dlp audio extraction failed for {url}: {result.stderr[:500]}")
        return None

    candidates = list(workdir.glob("source_audio*.mp3")) + list(workdir.glob("source_audio*.*"))
    return candidates[0] if candidates else None


async def convert_audio_with_ffmpeg(input_path: Path, workdir: Path) -> Optional[Path]:
    """Normalize audio to mono 16k WAV for Whisper."""
    output_path = workdir / "audio.wav"
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_path),
        "-ac",
        "1",
        "-ar",
        "16000",
        str(output_path),
    ]
    result = await run_command(command, timeout_seconds=180)
    if result.returncode != 0:
        logger.info(f"ffmpeg conversion failed: {result.stderr[:500]}")
        return None
    return output_path if output_path.exists() else None


async def transcribe_with_faster_whisper(audio_path: Path) -> Optional[str]:
    """Transcribe local audio using faster-whisper."""
    try:
        from faster_whisper import WhisperModel
    except Exception as e:
        logger.warning(f"faster-whisper unavailable: {e}")
        return None

    def _transcribe() -> Optional[str]:
        try:
            model = WhisperModel(
                WHISPER_MODEL_SIZE,
                device=WHISPER_DEVICE,
                compute_type=WHISPER_COMPUTE_TYPE,
            )
            segments, _info = model.transcribe(str(audio_path), beam_size=5)
            return " ".join(segment.text.strip() for segment in segments if segment.text).strip() or None
        except Exception as e:
            logger.error(f"Whisper transcription failed: {e}")
            return None

    return await asyncio.to_thread(_transcribe)


async def extract_transcript_from_url(url: str, platform: SourcePlatform) -> dict:
    """Extract/cached transcript for supported video platforms."""
    cached = await get_cached_transcript(url)
    if cached and cached.get("transcript"):
        return {
            "transcript": cached["transcript"],
            "method": cached.get("method", "cache"),
            "cached": True,
        }

    if platform not in {"youtube", "instagram"}:
        return {"transcript": "", "method": "unsupported_platform", "cached": False}

    with tempfile.TemporaryDirectory(prefix="foodievault-transcript-") as tmp:
        workdir = Path(tmp)

        if platform == "youtube":
            transcript = await fetch_youtube_transcript_api(url)
            if transcript:
                record = await save_cached_transcript(url, platform, transcript, "youtube_transcript_api")
                return {"transcript": record["transcript"], "method": record["method"], "cached": False}

            transcript = await fetch_ytdlp_captions(url, workdir)
            if transcript:
                record = await save_cached_transcript(url, platform, transcript, "yt_dlp_captions")
                return {"transcript": record["transcript"], "method": record["method"], "cached": False}

        audio_path = await extract_audio_with_ytdlp(url, workdir)
        if not audio_path:
            return {"transcript": "", "method": "audio_extraction_failed", "cached": False}

        normalized_audio = await convert_audio_with_ffmpeg(audio_path, workdir)
        if not normalized_audio:
            return {"transcript": "", "method": "ffmpeg_conversion_failed", "cached": False}

        transcript = await transcribe_with_faster_whisper(normalized_audio)
        if not transcript:
            return {"transcript": "", "method": "whisper_failed", "cached": False}

        record = await save_cached_transcript(url, platform, transcript, "faster_whisper")
        return {"transcript": record["transcript"], "method": record["method"], "cached": False}


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
Users share social media posts (Instagram/YouTube/TikTok) about food experiences. Your job: extract structured info from the available metadata and transcript. When transcript text is available, treat it as the primary source of truth because it captures what was actually said in the video.

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


async def extract_with_ai(metadata: dict, url: str, platform: SourcePlatform, transcript: str = "") -> dict:
    """Use Gemini via Emergent LLM key to extract structured data."""
    source_blob = f"""PLATFORM: {platform}
URL: {url}
TITLE: {metadata.get('title', '')}
DESCRIPTION: {metadata.get('description', '')}
TRANSCRIPT: {sanitize_transcript_text(transcript)}
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
    transcript_data = await extract_transcript_from_url(url, platform)
    ai_data = await extract_with_ai(metadata, url, platform, transcript_data.get("transcript", ""))

    result = {
        **ai_data,
        "source_platform": platform,
        "source_url": url,
        "thumbnail_url": metadata.get("thumbnail") or None,
        "transcript_available": bool(transcript_data.get("transcript")),
        "transcript_method": transcript_data.get("method"),
        "transcript_cached": bool(transcript_data.get("cached")),
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
