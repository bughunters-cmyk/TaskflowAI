import os
import hmac
import io
import wave
import hashlib
import json
import re
import secrets
import time
import traceback
from datetime import datetime, timezone
from typing import List, Optional
from pathlib import Path
from dotenv import load_dotenv

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Depends, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
import requests
from supabase import create_client, Client
from jose import jwt, JWTError
from uuid import uuid4, UUID

# ------------------------------------------------------------------
# Environment
# ------------------------------------------------------------------
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)   # .env wins over stale shell variables

def env_clean(name: str) -> Optional[str]:
    """Read an env var and strip stray spaces / quotes that often sneak in when pasting a key."""
    v = os.getenv(name)
    if v is None:
        return None
    v = v.strip().strip('"').strip("'").strip()
    return v or None

SARVAM_API_KEY = env_clean("SARVAM_API_KEY")
GEMINI_API_KEY = env_clean("GEMINI_API_KEY")
GROQ_API_KEY = env_clean("GROQ_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")          # service_role key recommended for backend
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")  # from Supabase → Settings → API → JWT Secret
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GROQ_LLM_MODEL = os.getenv("GROQ_LLM_MODEL", "openai/gpt-oss-120b")
GROQ_WHISPER_MODEL = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")
FRONTEND_ORIGINS = [o.strip() for o in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")]

# Optional global super-admin key (for emergency)
SUPER_ADMIN_KEY = os.getenv("SUPER_ADMIN_KEY")

# --- v1.1 (single-tenant) compatibility settings ---
TRELLO_API_KEY = os.getenv("TRELLO_API_KEY")          # global Trello board used by the legacy approval queue
TRELLO_TOKEN = os.getenv("TRELLO_TOKEN")
TRELLO_LIST_ID = os.getenv("TRELLO_LIST_ID")
API_SECRET_KEY = os.getenv("API_SECRET_KEY")          # legacy: x-api-secret header for audio/text submissions
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY")            # legacy: x-admin-key header for the admin approval queue
ENABLE_LEGACY_V1 = os.getenv("ENABLE_LEGACY_V1", "true").strip().lower() in ("1", "true", "yes", "on")
MAX_AUDIO_MB = float(os.getenv("MAX_AUDIO_MB", "25"))        # upload size cap (Groq Whisper accepts up to ~25 MB)
MAX_TEXT_CHARS = int(os.getenv("MAX_TEXT_CHARS", "100000"))  # pasted-transcript size cap

def _key_status(label: str, value: Optional[str]) -> str:
    if not value:
        return f"{label}: NOT SET"
    return f"{label}: set ({value[:4]}...{value[-4:]}, {len(value)} chars)"

print("🔑 " + " | ".join([
    _key_status("Groq", GROQ_API_KEY),
    _key_status("Gemini", GEMINI_API_KEY),
    _key_status("Sarvam", SARVAM_API_KEY),
]))
print(f"🔑 .env file: {env_path} ({'found' if env_path.exists() else 'NOT FOUND'})")
if GROQ_API_KEY and not GROQ_API_KEY.startswith("gsk_"):
    print("⚠️ GROQ_API_KEY does not start with 'gsk_' - Groq keys always do. Is a different key pasted here?")
if GEMINI_API_KEY and GEMINI_API_KEY.startswith("gsk_"):
    print("⚠️ GEMINI_API_KEY looks like a GROQ key (starts with 'gsk_'). The keys may be swapped.")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"⚠️ Supabase initialization failed: {e}")

app = FastAPI(title="TaskFlow AI – Multi-tenant Backend", version="2.0")

# Registered BEFORE the CORS middleware so it sits inside it: unexpected crashes are logged with a full
# traceback in this terminal and come back as a normal JSON error WITH CORS headers. (Without this the browser
# only shows a confusing "blocked by CORS / Failed to fetch" and hides the real problem.)
DEBUG_ERRORS = os.getenv("DEBUG_ERRORS", "true").strip().lower() in ("1", "true", "yes", "on")

@app.middleware("http")
async def catch_unhandled_errors(request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        traceback.print_exc()
        detail = f"Server error: {type(e).__name__}: {str(e)[:300]}" if DEBUG_ERRORS else "Internal server error"
        return JSONResponse(status_code=500, content={"detail": detail})

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)

# ------------------------------------------------------------------
# Auth helpers
# ------------------------------------------------------------------
class CurrentUser(BaseModel):
    id: str
    email: Optional[str] = None

_AUTH_CACHE: dict = {}
_AUTH_CACHE_TTL = 60  # seconds a verified token is trusted without re-checking

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> CurrentUser:
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = credentials.credentials
    now = time.monotonic()
    hit = _AUTH_CACHE.get(token)
    if hit and hit[0] > now:
        return hit[1]
    user = _verify_token(token)
    if len(_AUTH_CACHE) > 1000:
        _AUTH_CACHE.clear()
    _AUTH_CACHE[token] = (now + _AUTH_CACHE_TTL, user)
    return user

def _verify_token(token: str) -> CurrentUser:
    # 1) Fast path: verify locally with the legacy HS256 JWT secret
    if SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
            user_id = payload.get("sub")
            if user_id:
                return CurrentUser(id=user_id, email=payload.get("email"))
        except JWTError as e:
            print(f"ℹ️ Local JWT verify failed ({e}); trying Supabase auth server")

    # 2) Fallback: ask Supabase to validate the token (works with ES256/RS256 signing keys too)
    if supabase:
        try:
            res = supabase.auth.get_user(token)
            if res and res.user:
                return CurrentUser(id=res.user.id, email=res.user.email)
        except Exception as e:
            print(f"❌ Supabase get_user failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    raise HTTPException(status_code=503, detail="Auth not configured (set SUPABASE_JWT_SECRET or SUPABASE_URL/KEY)")

def require_db() -> Client:
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")
    return supabase

def get_user_firm_ids(user_id: str, db: Client) -> List[str]:
    res = (
        db.table("firm_members")
        .select("firm_id")
        .eq("user_id", user_id)
        .eq("status", "active")
        .execute()
    )
    return [r["firm_id"] for r in (res.data or [])]

def ensure_uuid(value, what: str = "Item") -> str:
    try:
        return str(UUID(str(value)))
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=404, detail=f"{what} not found")

def assert_firm_member(user_id: str, firm_id: str, db: Client, require_admin: bool = False):
    firm_id = ensure_uuid(firm_id, "Firm")
    q = (
        db.table("firm_members")
        .select("role, status")
        .eq("firm_id", firm_id)
        .eq("user_id", user_id)
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    if not q.data:
        raise HTTPException(status_code=403, detail="Not a member of this firm")
    if require_admin and q.data[0]["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin or owner role required")
    return q.data[0]["role"]

def generate_invite_code() -> str:
    return secrets.token_urlsafe(6).replace("-", "x").replace("_", "y").upper()[:8]

# ------------------------------------------------------------------
# Schemas
# ------------------------------------------------------------------
class TaskItem(BaseModel):
    id: Optional[str] = None
    task: str
    owner: Optional[str] = "Unassigned"
    due_date: Optional[str] = None
    type: str = "confirmed"
    evidence: Optional[str] = ""
    status: str = "pending"
    firm_id: Optional[str] = None
    meeting_id: Optional[str] = None

class TaskExtractionResponse(BaseModel):
    status: str
    transcript: str
    meeting_id: Optional[str] = None
    tasks: List[TaskItem]

class TextExtractionRequest(BaseModel):
    text: str
    firm_id: str
    title: Optional[str] = None

class CreateFirmRequest(BaseModel):
    name: str
    slug: Optional[str] = None

class JoinFirmRequest(BaseModel):
    invite_code: Optional[str] = None
    slug: Optional[str] = None   # legacy alias: the value is treated as the invite code

class TrelloConfigCreate(BaseModel):
    firm_id: str
    name: str = "Default Board"
    api_key: str
    token: str
    list_id: str
    is_default: bool = True

class ApproveRequest(BaseModel):
    task: Optional[str] = None
    owner: Optional[str] = None
    due_date: Optional[str] = None
    trello_config_id: Optional[str] = None   # which board to use

class RejectRequest(BaseModel):
    reason: Optional[str] = None

class LegacyTextRequest(BaseModel):
    text: str

class LegacyApproveRequest(BaseModel):
    # Optional admin edits applied at approval time (v1.1)
    task: Optional[str] = None
    owner: Optional[str] = None
    due_date: Optional[str] = None
    reviewed_by: Optional[str] = "admin"

class LegacyRejectRequest(BaseModel):
    reason: Optional[str] = None
    reviewed_by: Optional[str] = "admin"

class UpdateMemberRoleRequest(BaseModel):
    role: str = Field(..., pattern="^(owner|admin|member)$")

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s[:40] or str(uuid4())[:8]

def clean_due_date(value) -> Optional[str]:
    if not value or not isinstance(value, str):
        return None
    try:
        datetime.strptime(value.strip(), "%Y-%m-%d")
        return value.strip()
    except ValueError:
        return None

def parse_llm_json(raw_text: str) -> dict:
    cleaned = raw_text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    data = json.loads(cleaned.strip())
    if isinstance(data, list):          # model returned a bare list of tasks
        data = {"tasks": data}
    if not isinstance(data, dict):
        raise ValueError("LLM did not return a JSON object")
    return data

def call_llm_extraction(transcript: str) -> dict:
    today_str = datetime.now().strftime("%Y-%m-%d")
    system_prompt = (
        f"Today's date is {today_str}.\n"
        "You are an expert meeting analyst. Extract actionable action items and tentative discussions from the transcript.\n"
        "Return STRICT JSON only matching this schema with no markdown formatting:\n"
        "{\n"
        '  "tasks": [\n'
        "    {\n"
        '      "task": "Task description",\n'
        '      "owner": "Assignee name or Unassigned",\n'
        '      "due_date": "YYYY-MM-DD or null",\n'
        '      "type": "confirmed or tentative",\n'
        '      "evidence": "Direct quote from transcript"\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    if GEMINI_API_KEY:
        try:
            gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
            payload = {
                "contents": [{"parts": [{"text": f"{system_prompt}\n\nTranscript:\n{transcript}"}]}],
                "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1},
            }
            resp = requests.post(
                gemini_url,
                headers={"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY},
                json=payload,
                timeout=25,
            )
            if resp.status_code == 200:
                raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                return parse_llm_json(raw_text)
            print(f"❌ Gemini API Error {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"❌ Gemini Exception: {e}")

    if GROQ_API_KEY:
        try:
            payload = {
                "model": GROQ_LLM_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Transcript:\n{transcript}"},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.1,
            }
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json=payload,
                timeout=25,
            )
            if resp.status_code == 200:
                return parse_llm_json(resp.json()["choices"][0]["message"]["content"])
            print(f"❌ Groq API Error {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"❌ Groq Exception: {e}")

    raise HTTPException(status_code=502, detail="Both AI providers failed to extract tasks.")

def create_trello_card(
    api_key: str,
    token: str,
    list_id: str,
    task: str,
    owner: str,
    due_date: Optional[str],
    evidence: str,
) -> dict:
    params = {
        "key": api_key,
        "token": token,
        "idList": list_id,
        "name": f"[{owner or 'Unassigned'}] {task}",
        "desc": f"**Assigned Owner:** {owner or 'Unassigned'}\n\n**Evidence Quote:** *\"{evidence or 'N/A'}\"*",
    }
    if due_date:
        params["due"] = f"{due_date}T12:00:00.000Z"
    try:
        # credentials go in the POST body, never in the URL (URLs end up in exception messages and logs)
        resp = requests.post("https://api.trello.com/1/cards", data=params, timeout=15)
    except requests.RequestException as e:
        print(f"❌ Trello network error: {type(e).__name__}")
        raise HTTPException(status_code=502, detail="Could not reach Trello. Please try again.")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Trello API error ({resp.status_code}): {resp.text[:300]}")
    return resp.json()

# ------------------------------------------------------------------
# Firm management
# ------------------------------------------------------------------
@app.post("/api/firms")
def create_firm(body: CreateFirmRequest, user: CurrentUser = Depends(get_current_user)):
    db = require_db()
    slug = body.slug or slugify(body.name)
    # ensure unique slug
    existing = db.table("firms").select("id").eq("slug", slug).execute()
    if existing.data:
        slug = f"{slug}-{str(uuid4())[:6]}"

    firm = (
        db.table("firms")
        .insert({"name": body.name, "slug": slug, "created_by": user.id, "invite_code": generate_invite_code()})
        .execute()
        .data[0]
    )
    # add creator as owner (undo the firm if this fails so we never leave an ownerless firm behind)
    try:
        db.table("firm_members").insert(
            {"firm_id": firm["id"], "user_id": user.id, "role": "owner", "status": "active"}
        ).execute()
    except Exception as e:
        db.table("firms").delete().eq("id", firm["id"]).execute()
        raise HTTPException(status_code=500, detail=f"Could not create firm: {e}")
    return firm

@app.get("/api/firms")
def list_my_firms(user: CurrentUser = Depends(get_current_user)):
    db = require_db()
    res = (
        db.table("firm_members")
        .select("role, status, firm:firms(id, name, slug, invite_code, created_at)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .execute()
    )
    return {"firms": res.data or []}

@app.post("/api/firms/join")
def join_firm(body: JoinFirmRequest, user: CurrentUser = Depends(get_current_user)):
    db = require_db()
    code = (body.invite_code or body.slug or "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Invite code required")
    firm_res = db.table("firms").select("id").eq("invite_code", code).limit(1).execute()
    if not firm_res.data:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    firm_id = firm_res.data[0]["id"]

    # already member?
    existing = (
        db.table("firm_members")
        .select("id, status")
        .eq("firm_id", firm_id)
        .eq("user_id", user.id)
        .execute()
    )
    if existing.data:
        row = existing.data[0]
        if row["status"] == "active":
            return {"status": "already_member", "firm_id": firm_id}
        # re-activate
        db.table("firm_members").update({"status": "active", "role": "member"}).eq("id", row["id"]).execute()
        return {"status": "rejoined", "firm_id": firm_id}

    db.table("firm_members").insert(
        {"firm_id": firm_id, "user_id": user.id, "role": "member", "status": "active"}
    ).execute()
    return {"status": "joined", "firm_id": firm_id}

@app.post("/api/firms/{firm_id}/leave")
def leave_firm(firm_id: str, user: CurrentUser = Depends(get_current_user)):
    db = require_db()
    my_role = assert_firm_member(user.id, firm_id, db)
    if my_role == "owner":
        owners = db.table("firm_members").select("user_id").eq("firm_id", firm_id).eq("role", "owner").eq("status", "active").execute().data or []
        others = db.table("firm_members").select("user_id").eq("firm_id", firm_id).eq("status", "active").neq("user_id", user.id).execute().data or []
        if len(owners) <= 1 and others:
            raise HTTPException(status_code=400, detail="You are the only owner. Promote another owner before leaving.")
    res = (
        db.table("firm_members")
        .update({"status": "removed"})
        .eq("firm_id", firm_id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Membership not found")
    return {"status": "left"}

@app.get("/api/firms/{firm_id}/members")
def list_members(firm_id: str, user: CurrentUser = Depends(get_current_user)):
    db = require_db()
    assert_firm_member(user.id, firm_id, db)
    res = (
        db.table("firm_members")
        .select("id, user_id, role, status, joined_at")
        .eq("firm_id", firm_id)
        .neq("status", "removed")
        .order("joined_at")
        .execute()
    )
    return {"members": res.data or []}

@app.patch("/api/firms/{firm_id}/members/{member_user_id}")
def update_member_role(
    firm_id: str,
    member_user_id: str,
    body: UpdateMemberRoleRequest,
    user: CurrentUser = Depends(get_current_user),
):
    db = require_db()
    caller_role = assert_firm_member(user.id, firm_id, db, require_admin=True)
    target = (
        db.table("firm_members").select("role")
        .eq("firm_id", firm_id).eq("user_id", member_user_id).eq("status", "active")
        .limit(1).execute().data
    )
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")
    target_role = target[0]["role"]
    if (body.role == "owner" or target_role == "owner") and caller_role != "owner":
        raise HTTPException(status_code=403, detail="Only an owner can grant or change the owner role")
    if target_role == "owner" and body.role != "owner":
        owners = db.table("firm_members").select("user_id").eq("firm_id", firm_id).eq("role", "owner").eq("status", "active").execute().data or []
        if len(owners) <= 1:
            raise HTTPException(status_code=400, detail="A firm must keep at least one owner")
    res = (
        db.table("firm_members")
        .update({"role": body.role})
        .eq("firm_id", firm_id)
        .eq("user_id", member_user_id)
        .eq("status", "active")
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Member not found")
    return {"status": "updated", "member": res.data[0]}

@app.delete("/api/firms/{firm_id}/members/{member_user_id}")
def kick_member(
    firm_id: str,
    member_user_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    db = require_db()
    caller_role = assert_firm_member(user.id, firm_id, db, require_admin=True)
    if member_user_id == user.id:
        raise HTTPException(status_code=400, detail="Use /leave instead of kicking yourself")
    target = (
        db.table("firm_members").select("role")
        .eq("firm_id", firm_id).eq("user_id", member_user_id).eq("status", "active")
        .limit(1).execute().data
    )
    if target and target[0]["role"] == "owner" and caller_role != "owner":
        raise HTTPException(status_code=403, detail="Only an owner can remove an owner")
    res = (
        db.table("firm_members")
        .update({"status": "removed"})
        .eq("firm_id", firm_id)
        .eq("user_id", member_user_id)
        .eq("status", "active")
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Member not found")
    return {"status": "kicked"}


@app.delete("/api/firms/{firm_id}")
def delete_firm(firm_id: str, user: CurrentUser = Depends(get_current_user)):
    """
    Permanently delete a firm and all related data.
    Only the owner can do this. This cannot be undone.
    """
    db = require_db()
    firm_id = ensure_uuid(firm_id, "Firm")

    membership = (
        db.table("firm_members")
        .select("role, status")
        .eq("firm_id", firm_id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    if not membership.data:
        raise HTTPException(status_code=403, detail="Not a member of this firm")
    if membership.data[0]["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can delete this firm")

    firm = db.table("firms").select("id, name").eq("id", firm_id).limit(1).execute()
    if not firm.data:
        raise HTTPException(status_code=404, detail="Firm not found")

    # Delete related rows first (safe even if FK cascade is already set)
    for table in ("tasks", "meetings", "firm_trello_configs", "audio_hashes_v2", "firm_members"):
        try:
            db.table(table).delete().eq("firm_id", firm_id).execute()
        except Exception as e:
            print(f"⚠️ Cleanup {table}: {e}")

    try:
        db.table("audio_hashes").delete().eq("firm_id", firm_id).execute()
    except Exception:
        pass

    deleted = db.table("firms").delete().eq("id", firm_id).execute()
    if not deleted.data:
        raise HTTPException(status_code=500, detail="Failed to delete firm")

    return {"status": "deleted", "firm_id": firm_id, "name": firm.data[0]["name"]}


@app.get("/api/firms/{firm_id}/invite-code")
def get_invite_code(firm_id: str, user: CurrentUser = Depends(get_current_user)):
    db = require_db()
    assert_firm_member(user.id, firm_id, db, require_admin=True)
    res = db.table("firms").select("invite_code").eq("id", firm_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Firm not found")
    return {"invite_code": res.data[0].get("invite_code")}

@app.post("/api/firms/{firm_id}/invite-code/regenerate")
def regenerate_invite_code(firm_id: str, user: CurrentUser = Depends(get_current_user)):
    db = require_db()
    assert_firm_member(user.id, firm_id, db, require_admin=True)
    code = generate_invite_code()
    db.table("firms").update({"invite_code": code}).eq("id", firm_id).execute()
    return {"invite_code": code}

# ------------------------------------------------------------------
# Trello configs (per firm)
# ------------------------------------------------------------------
@app.post("/api/trello-configs")
def add_trello_config(body: TrelloConfigCreate, user: CurrentUser = Depends(get_current_user)):
    db = require_db()
    assert_firm_member(user.id, body.firm_id, db, require_admin=True)

    if body.is_default:
        # unset previous defaults
        db.table("firm_trello_configs").update({"is_default": False}).eq("firm_id", body.firm_id).execute()

    row = (
        db.table("firm_trello_configs")
        .insert({
            "firm_id": body.firm_id,
            "name": body.name,
            "api_key": body.api_key,
            "token": body.token,
            "list_id": body.list_id,
            "is_default": body.is_default,
        })
        .execute()
        .data[0]
    )
    return row

@app.get("/api/firms/{firm_id}/trello-configs")
def list_trello_configs(firm_id: str, user: CurrentUser = Depends(get_current_user)):
    db = require_db()
    assert_firm_member(user.id, firm_id, db)
    res = (
        db.table("firm_trello_configs")
        .select("id, name, list_id, is_default, created_at")
        .eq("firm_id", firm_id)
        .order("created_at")
        .execute()
    )
    return {"configs": res.data or []}

# ------------------------------------------------------------------
# Submission endpoints (scoped)
# ------------------------------------------------------------------
_AUDIO_EXT_TO_MIME = {
    ".wav": "audio/wav", ".mp3": "audio/mpeg", ".mpga": "audio/mpeg", ".mpeg": "audio/mpeg",
    ".m4a": "audio/mp4", ".mp4": "audio/mp4", ".webm": "audio/webm", ".ogg": "audio/ogg",
    ".oga": "audio/ogg", ".flac": "audio/flac", ".aac": "audio/aac",
}
_AUDIO_MIME_TO_EXT = {
    "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/wave": ".wav", "audio/vnd.wave": ".wav",
    "audio/mpeg": ".mp3", "audio/mp3": ".mp3", "audio/mpeg3": ".mp3", "audio/x-mpeg-3": ".mp3",
    "audio/mp4": ".m4a", "audio/x-m4a": ".m4a", "audio/m4a": ".m4a", "video/mp4": ".mp4",
    "audio/aac": ".aac", "audio/webm": ".webm", "video/webm": ".webm",
    "audio/ogg": ".ogg", "application/ogg": ".ogg", "audio/flac": ".flac", "audio/x-flac": ".flac",
}

def prepare_audio_meta(filename: Optional[str], content_type: Optional[str]):
    """Returns (filename_with_valid_extension, mime). Browser recordings often arrive as a nameless 'blob'
    with only a content type; STT providers pick the decoder from the file extension, so we must set one."""
    name = (filename or "").strip() or "recording"
    ext = os.path.splitext(name)[1].lower()
    mime = (content_type or "").split(";")[0].strip().lower()
    if ext not in _AUDIO_EXT_TO_MIME:
        ext_from_mime = _AUDIO_MIME_TO_EXT.get(mime)
        if not ext_from_mime:
            raise HTTPException(
                status_code=415,
                detail="Unsupported audio format. Use WAV, MP3, M4A, MP4, OGG, FLAC or WebM (browser recording).",
            )
        name = os.path.splitext(name)[0] + ext_from_mime
        ext = ext_from_mime
    if mime not in _AUDIO_MIME_TO_EXT:
        mime = _AUDIO_EXT_TO_MIME[ext]
    return name, mime

def read_audio_upload(file: UploadFile) -> bytes:
    limit = int(MAX_AUDIO_MB * 1024 * 1024)
    try:
        data = file.file.read(limit + 1)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")
    if not data:
        raise HTTPException(status_code=400, detail="The audio file is empty")
    if len(data) > limit:
        raise HTTPException(status_code=413, detail=f"Audio file too large (max {MAX_AUDIO_MB:g} MB)")
    return data

def claim_audio_hash(db: Client, firm_id: str, audio_hash: str) -> bool:
    """Atomically reserve this audio for the firm. True = new audio, False = already processed.
    Relies on the UNIQUE (firm_id, hash) constraint, so two simultaneous uploads cannot both win."""
    try:
        db.table("audio_hashes_v2").insert({"firm_id": firm_id, "hash": audio_hash}).execute()
        return True
    except Exception as e:
        msg = str(e).lower()
        if "duplicate" in msg or "23505" in msg or "unique" in msg:
            return False
        raise HTTPException(status_code=500, detail=f"Could not record audio fingerprint: {e}")

def release_audio_hash(db: Client, firm_id: str, audio_hash: str) -> None:
    """Undo a claim when processing failed, so the same file can be retried."""
    try:
        db.table("audio_hashes_v2").delete().eq("firm_id", firm_id).eq("hash", audio_hash).execute()
    except Exception as e:
        print(f"⚠️ Could not release audio hash: {e}")

SARVAM_MAX_SECONDS = 28   # Sarvam's synchronous API rejects audio longer than 30 s

def split_wav(audio_bytes: bytes, max_seconds: int) -> Optional[List[bytes]]:
    """Cut a PCM .wav into chunks of at most max_seconds. Returns None if it isn't a readable PCM wav."""
    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as w:
            params = w.getparams()
            per_chunk = int(w.getframerate() * max_seconds)
            total = w.getnframes()
            if per_chunk <= 0 or total <= 0:
                return None
            chunks = []
            for start in range(0, total, per_chunk):
                w.setpos(start)
                frames = w.readframes(min(per_chunk, total - start))
                buf = io.BytesIO()
                with wave.open(buf, "wb") as out:
                    out.setparams(params)
                    out.writeframes(frames)
                chunks.append(buf.getvalue())
            return chunks
    except Exception:
        return None

def _sarvam_transcribe(name: str, data: bytes, mime: str) -> Optional[str]:
    """One Sarvam call. Returns the text, or None on any failure (reason is printed to the terminal)."""
    try:
        resp = requests.post(
            "https://api.sarvam.ai/speech-to-text-translate",
            headers={"api-subscription-key": SARVAM_API_KEY},
            files={"file": (name, data, mime)},
            timeout=45,
        )
    except Exception as e:
        print(f"⚠️ Sarvam network error: {type(e).__name__}: {e}")
        return None
    if resp.status_code != 200:
        print(f"⚠️ Sarvam STT failed ({resp.status_code}): {resp.text[:300]}")
        return None
    return (resp.json().get("transcript") or "")

def transcribe_audio(audio_bytes: bytes, filename: Optional[str], content_type: Optional[str]) -> str:
    """Speech-to-text: Sarvam first (long WAVs are split into <30 s pieces), Groq Whisper as fallback.
    Returns '' only when the audio genuinely contained no speech; real failures raise an HTTP error."""
    if not SARVAM_API_KEY and not GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="No speech-to-text key configured. Set SARVAM_API_KEY and/or GROQ_API_KEY in the backend .env.",
        )

    transcript = ""
    sarvam_failed = False
    filename, clean_mime = prepare_audio_meta(filename, content_type)

    if SARVAM_API_KEY:
        chunks = split_wav(audio_bytes, SARVAM_MAX_SECONDS) if clean_mime == "audio/wav" else None
        if chunks and len(chunks) > 1:
            parts = []
            for i, chunk in enumerate(chunks, start=1):
                text = _sarvam_transcribe(f"part{i}.wav", chunk, "audio/wav")
                if text is None:
                    parts = None
                    break
                parts.append(text.strip())
            if parts is None:
                sarvam_failed = True
            else:
                transcript = " ".join(t for t in parts if t)
        else:
            text = _sarvam_transcribe(filename, audio_bytes, clean_mime)
            if text is None:
                sarvam_failed = True
            else:
                transcript = text

    if not transcript and GROQ_API_KEY:
        try:
            resp = requests.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                files={"file": (filename, audio_bytes, clean_mime)},
                data={"model": GROQ_WHISPER_MODEL},
                timeout=60,
            )
        except Exception as e:
            print(f"❌ Groq network error: {type(e).__name__}: {e}")
            raise HTTPException(status_code=502, detail=f"Speech-to-text failed: could not reach Groq ({type(e).__name__}).")
        if resp.status_code == 200:
            transcript = resp.json().get("text", "") or ""
        else:
            print(f"❌ Groq STT failed ({resp.status_code}): {resp.text[:500]}")
            hint = "Sarvam also failed. " if sarvam_failed else ""
            raise HTTPException(
                status_code=502,
                detail=f"Speech-to-text failed. {hint}Groq returned {resp.status_code}: {resp.text[:200]}",
            )
    elif not transcript and sarvam_failed:
        raise HTTPException(
            status_code=502,
            detail="Speech-to-text failed (Sarvam error - see the backend terminal). Add GROQ_API_KEY to enable the fallback.",
        )

    return transcript

@app.post("/api/process-audio", response_model=TaskExtractionResponse)
def process_audio(
    file: UploadFile = File(...),
    firm_id: str = Query(...),
    title: Optional[str] = Query(None),
    user: CurrentUser = Depends(get_current_user),
):
    # NOTE: a plain `def` (not `async def`) on purpose. FastAPI runs it in a worker thread, so the many seconds
    # spent in speech-to-text / LLM calls do not freeze every other request (logins, dashboards, ...).
    db = require_db()
    assert_firm_member(user.id, firm_id, db)
    firm_id = ensure_uuid(firm_id, "Firm")

    audio_bytes = read_audio_upload(file)
    name, mime = prepare_audio_meta(file.filename, file.content_type)
    audio_hash = hashlib.sha256(audio_bytes).hexdigest()

    # Dedup per firm (atomic). Reserved up front, and released again if anything below fails.
    if not claim_audio_hash(db, firm_id, audio_hash):
        return TaskExtractionResponse(status="duplicate", transcript="[Duplicate Audio Detected]", tasks=[])

    meeting_id = None
    try:
        transcript = transcribe_audio(audio_bytes, name, mime)
        if not transcript.strip():
            release_audio_hash(db, firm_id, audio_hash)
            return TaskExtractionResponse(status="success", transcript="", tasks=[])

        meeting = (
            db.table("meetings")
            .insert({
                "firm_id": firm_id,
                "user_id": user.id,
                "title": title or file.filename or "Recording",
                "transcript": transcript,
                "audio_hash": audio_hash,
            })
            .execute()
            .data[0]
        )
        meeting_id = meeting["id"]
        tasks = extract_and_queue(transcript, firm_id, user.id, meeting_id, db)
    except Exception:
        # Failed part-way: remove the half-made meeting and free the hash so a retry works.
        if meeting_id:
            try:
                db.table("meetings").delete().eq("id", meeting_id).execute()
            except Exception as ce:
                print(f"⚠️ Could not clean up meeting {meeting_id}: {ce}")
        release_audio_hash(db, firm_id, audio_hash)
        raise

    return TaskExtractionResponse(
        status="success",
        transcript=transcript,
        meeting_id=meeting_id,
        tasks=tasks,
    )

@app.post("/api/process-text", response_model=TaskExtractionResponse)
def process_text(req: TextExtractionRequest, user: CurrentUser = Depends(get_current_user)):
    db = require_db()
    assert_firm_member(user.id, req.firm_id, db)

    if not req.text.strip():
        return TaskExtractionResponse(status="success", transcript="", tasks=[])
    if len(req.text) > MAX_TEXT_CHARS:
        raise HTTPException(status_code=413, detail=f"Transcript too long (max {MAX_TEXT_CHARS:,} characters)")

    meeting = (
        db.table("meetings")
        .insert({
            "firm_id": req.firm_id,
            "user_id": user.id,
            "title": req.title or "Text Input",
            "transcript": req.text,
        })
        .execute()
        .data[0]
    )

    try:
        tasks = extract_and_queue(req.text, req.firm_id, user.id, meeting["id"], db)
    except Exception:
        try:
            db.table("meetings").delete().eq("id", meeting["id"]).execute()
        except Exception as ce:
            print(f"⚠️ Could not clean up meeting {meeting['id']}: {ce}")
        raise
    return TaskExtractionResponse(
        status="success",
        transcript=req.text,
        meeting_id=meeting["id"],
        tasks=tasks,
    )

def extract_and_queue(
    transcript: str,
    firm_id: str,
    user_id: str,
    meeting_id: str,
    db: Client,
) -> List[TaskItem]:
    raw_tasks = call_llm_extraction(transcript).get("tasks", [])
    if not isinstance(raw_tasks, list):
        raw_tasks = []
    rows = []
    for t in raw_tasks:
        if isinstance(t, dict) and t.get("task"):
            rows.append({
                "firm_id": firm_id,
                "meeting_id": meeting_id,
                "user_id": user_id,
                "task": t["task"],
                "owner": t.get("owner") or "Unassigned",
                "due_date": clean_due_date(t.get("due_date")),
                "type": t.get("type") if t.get("type") in ("confirmed", "tentative") else "confirmed",
                "evidence": t.get("evidence") or "",
                "status": "pending",
            })
    if not rows:
        return []

    try:
        saved = db.table("tasks").insert(rows).execute().data
    except Exception as e:
        print(f"⚠️ Failed to queue tasks: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save tasks: {e}")

    return [
        TaskItem(
            id=r.get("id"),
            task=r["task"],
            owner=r.get("owner"),
            due_date=r.get("due_date"),
            type=r.get("type", "confirmed"),
            evidence=r.get("evidence"),
            status=r.get("status", "pending"),
            firm_id=r.get("firm_id"),
            meeting_id=r.get("meeting_id"),
        )
        for r in saved
    ]

# ------------------------------------------------------------------
# Meetings history (scoped)
# ------------------------------------------------------------------
@app.get("/api/meetings")
def list_meetings(
    firm_id: str = Query(...),
    limit: int = Query(50, le=200),
    user: CurrentUser = Depends(get_current_user),
):
    db = require_db()
    assert_firm_member(user.id, firm_id, db)
    res = (
        db.table("meetings")
        .select("id, title, transcript, user_id, created_at")
        .eq("firm_id", firm_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return {"meetings": res.data or []}

@app.get("/api/meetings/{meeting_id}")
def get_meeting(meeting_id: str, user: CurrentUser = Depends(get_current_user)):
    db = require_db()
    meeting_id = ensure_uuid(meeting_id, "Meeting")
    res = db.table("meetings").select("*").eq("id", meeting_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Meeting not found")
    meeting = res.data[0]
    assert_firm_member(user.id, meeting["firm_id"], db)
    return meeting

# ------------------------------------------------------------------
# Tasks (scoped)
# ------------------------------------------------------------------
@app.get("/api/tasks")
def list_tasks(
    firm_id: str = Query(...),
    status: str = Query("pending", pattern="^(pending|approved|rejected)$"),
    user: CurrentUser = Depends(get_current_user),
):
    db = require_db()
    assert_firm_member(user.id, firm_id, db)
    res = (
        db.table("tasks")
        .select(
            "id, task, owner, due_date, type, evidence, status, "
            "trello_card_url, trello_config_id, reviewed_by, reviewed_at, "
            "rejection_reason, meeting_id, user_id, created_at"
        )
        .eq("firm_id", firm_id)
        .eq("status", status)
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )
    return {"tasks": res.data or []}

@app.post("/api/tasks/{task_id}/approve")
def approve_task(
    task_id: str,
    body: ApproveRequest,
    user: CurrentUser = Depends(get_current_user),
):
    db = require_db()
    task_id = ensure_uuid(task_id, "Task")

    # Load task
    task_res = db.table("tasks").select("*").eq("id", task_id).limit(1).execute()
    if not task_res.data:
        raise HTTPException(status_code=404, detail="Task not found")
    task = task_res.data[0]
    firm_id = task["firm_id"]

    assert_firm_member(user.id, firm_id, db, require_admin=True)
    if body.trello_config_id:
        ensure_uuid(body.trello_config_id, "Trello board")

    # Atomic claim
    claim = (
        db.table("tasks")
        .update({
            "status": "approved",
            "reviewed_by": user.id,
            "reviewed_at": now_iso(),
        })
        .eq("id", task_id)
        .eq("status", "pending")
        .execute()
    )
    if not claim.data:
        raise HTTPException(status_code=409, detail="Task already reviewed")

    final_task = body.task or task["task"]
    final_owner = body.owner or task.get("owner") or "Unassigned"
    final_due = clean_due_date(body.due_date) if body.due_date else task.get("due_date")

    # Resolve Trello config
    trello_config_id = body.trello_config_id or task.get("trello_config_id")
    if trello_config_id:
        cfg_res = (
            db.table("firm_trello_configs")
            .select("*")
            .eq("id", trello_config_id)
            .eq("firm_id", firm_id)      # only this firm's own boards
            .limit(1)
            .execute()
        )
    else:
        cfg_res = (
            db.table("firm_trello_configs")
            .select("*")
            .eq("firm_id", firm_id)
            .eq("is_default", True)
            .limit(1)
            .execute()
        )
        if not cfg_res.data:
            # fallback to any config
            cfg_res = (
                db.table("firm_trello_configs")
                .select("*")
                .eq("firm_id", firm_id)
                .limit(1)
                .execute()
            )

    if not cfg_res.data:
        # rollback
        db.table("tasks").update({
            "status": "pending", "reviewed_by": None, "reviewed_at": None
        }).eq("id", task_id).execute()
        raise HTTPException(status_code=400, detail="No Trello configuration found for this firm")

    cfg = cfg_res.data[0]

    try:
        card = create_trello_card(
            cfg["api_key"], cfg["token"], cfg["list_id"],
            final_task, final_owner, final_due, task.get("evidence") or "",
        )
    except Exception:
        db.table("tasks").update({
            "status": "pending", "reviewed_by": None, "reviewed_at": None
        }).eq("id", task_id).execute()
        raise

    db.table("tasks").update({
        "task": final_task,
        "owner": final_owner,
        "due_date": final_due,
        "trello_card_id": card.get("id"),
        "trello_card_url": card.get("url"),
        "trello_config_id": cfg["id"],
    }).eq("id", task_id).execute()

    return {
        "status": "success",
        "card_id": card.get("id"),
        "card_url": card.get("url"),
    }

@app.post("/api/tasks/{task_id}/reject")
def reject_task(
    task_id: str,
    body: RejectRequest,
    user: CurrentUser = Depends(get_current_user),
):
    db = require_db()
    task_id = ensure_uuid(task_id, "Task")
    task_res = db.table("tasks").select("firm_id, status").eq("id", task_id).limit(1).execute()
    if not task_res.data:
        raise HTTPException(status_code=404, detail="Task not found")
    task = task_res.data[0]
    assert_firm_member(user.id, task["firm_id"], db, require_admin=True)

    res = (
        db.table("tasks")
        .update({
            "status": "rejected",
            "reviewed_by": user.id,
            "reviewed_at": now_iso(),
            "rejection_reason": body.reason,
        })
        .eq("id", task_id)
        .eq("status", "pending")
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=409, detail="Task not found or already reviewed")
    return {"status": "rejected"}

# ------------------------------------------------------------------
# Health / me
# ------------------------------------------------------------------
@app.get("/api/me")
def me(user: CurrentUser = Depends(get_current_user)):
    return {"id": user.id, "email": user.email}

@app.get("/health")
def health():
    return {"status": "ok", "multi_tenant": True}

@app.get("/health/providers")
def health_providers():
    """Dev helper: checks whether the Groq / Gemini keys are accepted. Never returns the keys themselves.
    Disabled when DEBUG_ERRORS=false."""
    if not DEBUG_ERRORS:
        raise HTTPException(status_code=404, detail="Not found")

    def probe(name: str, key: Optional[str], url: str, headers: dict) -> dict:
        if not key:
            return {"configured": False, "ok": False, "detail": "key not set in .env"}
        try:
            r = requests.get(url, headers=headers, timeout=10)
        except Exception as e:
            return {"configured": True, "ok": False, "detail": f"could not reach {name}: {type(e).__name__}"}
        if r.status_code == 200:
            return {"configured": True, "ok": True, "detail": "key accepted"}
        return {"configured": True, "ok": False, "status": r.status_code, "detail": r.text[:200]}

    groq = probe("Groq", GROQ_API_KEY, "https://api.groq.com/openai/v1/models",
                 {"Authorization": f"Bearer {GROQ_API_KEY}"})
    if groq.get("ok"):
        # also confirm the model names in .env still exist for this key (models get retired)
        try:
            r = requests.get("https://api.groq.com/openai/v1/models",
                             headers={"Authorization": f"Bearer {GROQ_API_KEY}"}, timeout=10)
            models = r.json().get("data", [])
            ids = {m.get("id") for m in models}
            text_models = sorted(
                m["id"] for m in models
                if "text" in (m.get("output_modalities") or []) and "text" in (m.get("input_modalities") or [])
                and "guard" not in m["id"] and "safeguard" not in m["id"]
            )
            groq["llm_model"] = GROQ_LLM_MODEL
            groq["llm_model_available"] = GROQ_LLM_MODEL in ids
            groq["whisper_model"] = GROQ_WHISPER_MODEL
            groq["whisper_model_available"] = GROQ_WHISPER_MODEL in ids
            groq["text_models_you_can_use"] = text_models
            if GROQ_LLM_MODEL not in ids:
                groq["detail"] = f"key accepted, BUT model '{GROQ_LLM_MODEL}' is not available - set GROQ_LLM_MODEL in .env to one of text_models_you_can_use"
        except Exception:
            pass

    return {
        "groq": groq,
        "gemini": probe("Gemini", GEMINI_API_KEY, "https://generativelanguage.googleapis.com/v1beta/models",
                        {"x-goog-api-key": GEMINI_API_KEY or ""}),
        "sarvam": {"configured": bool(SARVAM_API_KEY), "detail": "no free check available; works if transcription runs"},
    }

# ------------------------------------------------------------------
# Optional: keep old admin verify for compatibility (super-admin only)
# ------------------------------------------------------------------
@app.get("/api/admin/verify")
def admin_verify(x_admin_key: Optional[str] = Header(None)):
    """Accepts either the super-admin key (v1.2) or the legacy ADMIN_API_KEY (v1.1)."""
    if x_admin_key:
        if SUPER_ADMIN_KEY and hmac.compare_digest(x_admin_key, SUPER_ADMIN_KEY):
            return {"status": "ok", "super_admin": True}
        if ADMIN_API_KEY and hmac.compare_digest(x_admin_key, ADMIN_API_KEY):
            return {"status": "ok"}
    raise HTTPException(status_code=401, detail="Unauthorized")


# ==================================================================
# v1.1 COMPATIBILITY (single-tenant API: pending_tasks + global Trello)
# Not firm-scoped. Uses the legacy tables pending_tasks / audio_hashes,
# the global TRELLO_* env vars, and header keys instead of user logins.
# Turn off entirely with ENABLE_LEGACY_V1=false.
# ==================================================================
def require_legacy_enabled():
    if not ENABLE_LEGACY_V1:
        raise HTTPException(status_code=404, detail="Not found")
    return True

def verify_api_secret(x_api_secret: Optional[str] = Header(None)):
    """Legacy submission gate (x-api-secret). Fails closed if API_SECRET_KEY isn't configured."""
    if not API_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Legacy submission API not configured (set API_SECRET_KEY).")
    if not x_api_secret or not hmac.compare_digest(x_api_secret, API_SECRET_KEY):
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid API Secret")
    return True

def verify_admin(x_admin_key: Optional[str] = Header(None)):
    """Legacy admin gate (x-admin-key). Fails closed if ADMIN_API_KEY isn't configured."""
    if not ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin access not configured on server.")
    if not x_admin_key or not hmac.compare_digest(x_admin_key, ADMIN_API_KEY):
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid admin key")
    return True

def legacy_check_and_store_hash(audio_bytes: bytes) -> bool:
    """True if this audio was already processed (legacy global table)."""
    audio_hash = hashlib.sha256(audio_bytes).hexdigest()
    if supabase:
        try:
            res = supabase.table("audio_hashes").select("hash").eq("hash", audio_hash).execute()
            if res.data and len(res.data) > 0:
                return True
            supabase.table("audio_hashes").insert({"hash": audio_hash}).execute()
        except Exception as e:
            print(f"⚠️ Supabase deduplication error: {e}")
    return False

def legacy_release_hash(audio_hash: str) -> None:
    if supabase:
        try:
            supabase.table("audio_hashes").delete().eq("hash", audio_hash).execute()
        except Exception as e:
            print(f"⚠️ Could not release legacy audio hash: {e}")

def legacy_extract_and_queue(transcript: str) -> List[TaskItem]:
    """Run LLM extraction and persist each task as 'pending' in the legacy pending_tasks queue."""
    raw_tasks = call_llm_extraction(transcript).get("tasks", [])
    rows = []
    if isinstance(raw_tasks, list):
        for t in raw_tasks:
            if isinstance(t, dict) and t.get("task"):
                rows.append({
                    "task": t["task"],
                    "owner": t.get("owner") or "Unassigned",
                    "due_date": clean_due_date(t.get("due_date")),
                    "type": t.get("type") if t.get("type") in ("confirmed", "tentative") else "confirmed",
                    "evidence": t.get("evidence") or "",
                    "source_transcript": transcript,
                    "status": "pending",
                })
    if not rows:
        return []
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured; cannot queue tasks for approval.")
    try:
        saved = supabase.table("pending_tasks").insert(rows).execute().data
    except Exception as e:
        print(f"⚠️ Failed to queue tasks: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save tasks to the approval queue: {e}")
    return [TaskItem(**{k: r.get(k) for k in TaskItem.model_fields if k in r}) for r in saved]

def create_trello_card_global(task: str, owner: str, due_date: Optional[str], evidence: str) -> dict:
    """Create a card on the single global board configured via TRELLO_API_KEY / TRELLO_TOKEN / TRELLO_LIST_ID."""
    if not TRELLO_API_KEY or not TRELLO_TOKEN or not TRELLO_LIST_ID:
        raise HTTPException(status_code=500, detail="Trello API configuration missing.")
    return create_trello_card(TRELLO_API_KEY, TRELLO_TOKEN, TRELLO_LIST_ID, task, owner, due_date, evidence)

@app.post(
    "/api/legacy/process-audio",
    response_model=TaskExtractionResponse,
    dependencies=[Depends(require_legacy_enabled)],
)
def legacy_process_audio(file: UploadFile = File(...), authenticated: bool = Depends(verify_api_secret)):
    audio_bytes = read_audio_upload(file)
    name, mime = prepare_audio_meta(file.filename, file.content_type)
    audio_hash = hashlib.sha256(audio_bytes).hexdigest()

    if legacy_check_and_store_hash(audio_bytes):
        return TaskExtractionResponse(status="duplicate", transcript="[Duplicate Audio Detected]", tasks=[])

    try:
        transcript = transcribe_audio(audio_bytes, name, mime)
        if not transcript.strip():
            legacy_release_hash(audio_hash)
            return TaskExtractionResponse(status="success", transcript="", tasks=[])
        tasks = legacy_extract_and_queue(transcript)
    except Exception:
        legacy_release_hash(audio_hash)   # failed -> allow a retry of the same file
        raise
    return TaskExtractionResponse(status="success", transcript=transcript, tasks=tasks)

@app.post(
    "/api/legacy/process-text",
    response_model=TaskExtractionResponse,
    dependencies=[Depends(require_legacy_enabled)],
)
def legacy_process_text(req: LegacyTextRequest, authenticated: bool = Depends(verify_api_secret)):
    if not req.text.strip():
        return TaskExtractionResponse(status="success", transcript="", tasks=[])
    return TaskExtractionResponse(status="success", transcript=req.text, tasks=legacy_extract_and_queue(req.text))

@app.get("/api/admin/tasks", dependencies=[Depends(require_legacy_enabled)])
def legacy_list_tasks(
    status: str = Query("pending", pattern="^(pending|approved|rejected)$"),
    _: bool = Depends(verify_admin),
):
    db = require_db()
    res = (
        db.table("pending_tasks")
        .select("id,task,owner,due_date,type,evidence,status,trello_card_url,reviewed_by,reviewed_at,rejection_reason,created_at")
        .eq("status", status)
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )
    return {"tasks": res.data}

@app.post("/api/admin/tasks/{task_id}/approve", dependencies=[Depends(require_legacy_enabled)])
def legacy_approve_task(task_id: str, body: LegacyApproveRequest, _: bool = Depends(verify_admin)):
    db = require_db()
    task_id = ensure_uuid(task_id, "Task")

    # Atomic claim: only one request can flip pending -> approved (prevents duplicate cards on double-click)
    claim = (
        db.table("pending_tasks")
        .update({"status": "approved", "reviewed_by": body.reviewed_by, "reviewed_at": now_iso()})
        .eq("id", task_id)
        .eq("status", "pending")
        .execute()
    )
    if not claim.data:
        exists = db.table("pending_tasks").select("status").eq("id", task_id).execute().data
        if not exists:
            raise HTTPException(status_code=404, detail="Task not found")
        raise HTTPException(status_code=409, detail=f"Task already {exists[0]['status']}")

    row = claim.data[0]
    final_task = body.task or row["task"]
    final_owner = body.owner or row.get("owner") or "Unassigned"
    final_due = clean_due_date(body.due_date) if body.due_date else row.get("due_date")

    try:
        card = create_trello_card_global(final_task, final_owner, final_due, row.get("evidence") or "")
    except Exception:
        # Roll back so the admin can retry
        db.table("pending_tasks").update(
            {"status": "pending", "reviewed_by": None, "reviewed_at": None}
        ).eq("id", task_id).execute()
        raise

    db.table("pending_tasks").update({
        "task": final_task, "owner": final_owner, "due_date": final_due,
        "trello_card_id": card.get("id"), "trello_card_url": card.get("url"),
    }).eq("id", task_id).execute()

    return {"status": "success", "card_id": card.get("id"), "card_url": card.get("url")}

@app.post("/api/admin/tasks/{task_id}/reject", dependencies=[Depends(require_legacy_enabled)])
def legacy_reject_task(task_id: str, body: LegacyRejectRequest, _: bool = Depends(verify_admin)):
    db = require_db()
    task_id = ensure_uuid(task_id, "Task")
    res = (
        db.table("pending_tasks")
        .update({
            "status": "rejected", "reviewed_by": body.reviewed_by,
            "reviewed_at": now_iso(), "rejection_reason": body.reason,
        })
        .eq("id", task_id)
        .eq("status", "pending")
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=409, detail="Task not found or already reviewed")
    return {"status": "rejected"}