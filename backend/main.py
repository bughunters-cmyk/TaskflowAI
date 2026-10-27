import os
import hmac
import hashlib
import json
import re
from datetime import datetime, timezone
from typing import List, Optional
from pathlib import Path
from dotenv import load_dotenv

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Depends, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
import requests
from supabase import create_client, Client
from jose import jwt, JWTError
from uuid import uuid4

# ------------------------------------------------------------------
# Environment
# ------------------------------------------------------------------
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")          # service_role key recommended for backend
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")  # from Supabase → Settings → API → JWT Secret
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
GROQ_LLM_MODEL = os.getenv("GROQ_LLM_MODEL", "llama-3.3-70b-versatile")
FRONTEND_ORIGINS = [o.strip() for o in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")]

# Optional global super-admin key (for emergency)
SUPER_ADMIN_KEY = os.getenv("SUPER_ADMIN_KEY")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"⚠️ Supabase initialization failed: {e}")

app = FastAPI(title="TaskFlow AI – Multi-tenant Backend", version="2.0")

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

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> CurrentUser:
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = credentials.credentials
    if not SUPABASE_JWT_SECRET:
        raise HTTPException(status_code=503, detail="JWT secret not configured")

    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: no sub")
        return CurrentUser(id=user_id, email=payload.get("email"))
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

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

def assert_firm_member(user_id: str, firm_id: str, db: Client, require_admin: bool = False):
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
    slug: str

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
    return json.loads(cleaned.strip())

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
            gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": f"{system_prompt}\n\nTranscript:\n{transcript}"}]}],
                "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1},
            }
            resp = requests.post(gemini_url, headers={"Content-Type": "application/json"}, json=payload, timeout=25)
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
        resp = requests.post("https://api.trello.com/1/cards", params=params, timeout=15)
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Trello network error: {e}")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Trello API error ({resp.status_code}): {resp.text}")
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
        .insert({"name": body.name, "slug": slug, "created_by": user.id})
        .execute()
        .data[0]
    )
    # add creator as owner
    db.table("firm_members").insert(
        {"firm_id": firm["id"], "user_id": user.id, "role": "owner", "status": "active"}
    ).execute()
    return firm

@app.get("/api/firms")
def list_my_firms(user: CurrentUser = Depends(get_current_user)):
    db = require_db()
    res = (
        db.table("firm_members")
        .select("role, status, firm:firms(id, name, slug, created_at)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .execute()
    )
    return {"firms": res.data or []}

@app.post("/api/firms/join")
def join_firm(body: JoinFirmRequest, user: CurrentUser = Depends(get_current_user)):
    db = require_db()
    firm_res = db.table("firms").select("id").eq("slug", body.slug).limit(1).execute()
    if not firm_res.data:
        raise HTTPException(status_code=404, detail="Firm not found")
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
    assert_firm_member(user.id, firm_id, db, require_admin=True)
    if member_user_id == user.id and body.role != "owner":
        # prevent last owner from demoting themselves easily – optional safeguard
        pass
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
    assert_firm_member(user.id, firm_id, db, require_admin=True)
    if member_user_id == user.id:
        raise HTTPException(status_code=400, detail="Use /leave instead of kicking yourself")
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
@app.post("/api/process-audio", response_model=TaskExtractionResponse)
async def process_audio(
    file: UploadFile = File(...),
    firm_id: str = Query(...),
    title: Optional[str] = Query(None),
    user: CurrentUser = Depends(get_current_user),
):
    db = require_db()
    assert_firm_member(user.id, firm_id, db)

    try:
        audio_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    audio_hash = hashlib.sha256(audio_bytes).hexdigest()

    # Dedup per firm
    existing = (
        db.table("audio_hashes")
        .select("hash")
        .eq("firm_id", firm_id)
        .eq("hash", audio_hash)
        .execute()
    )
    if existing.data:
        return TaskExtractionResponse(status="duplicate", transcript="[Duplicate Audio Detected]", tasks=[])

    db.table("audio_hashes").insert({"firm_id": firm_id, "hash": audio_hash}).execute()

    transcript = ""
    clean_mime = (file.content_type or "audio/wav").split(";")[0]

    if SARVAM_API_KEY:
        try:
            resp = requests.post(
                "https://api.sarvam.ai/speech-to-text-translate",
                headers={"api-subscription-key": SARVAM_API_KEY},
                files={"file": (file.filename, audio_bytes, clean_mime)},
                timeout=45,
            )
            if resp.status_code == 200:
                transcript = resp.json().get("transcript", "")
            else:
                print(f"⚠️ Sarvam STT failed ({resp.status_code})")
        except Exception as e:
            print(f"⚠️ Sarvam error: {e}")

    if not transcript and GROQ_API_KEY:
        try:
            resp = requests.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                files={"file": (file.filename, audio_bytes, clean_mime)},
                data={"model": "whisper-large-v3-turbo"},
                timeout=30,
            )
            if resp.status_code == 200:
                transcript = resp.json().get("text", "")
            else:
                raise HTTPException(status_code=500, detail=f"Groq STT failed: {resp.text}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"STT Pipeline failed: {e}")

    if not transcript:
        return TaskExtractionResponse(status="success", transcript="", tasks=[])

    # Create meeting
    meeting = (
        db.table("meetings")
        .insert({
            "firm_id": firm_id,
            "user_id": user.id,
            "title": title or file.filename or "Untitled Meeting",
            "transcript": transcript,
            "audio_hash": audio_hash,
        })
        .execute()
        .data[0]
    )

    tasks = extract_and_queue(transcript, firm_id, user.id, meeting["id"], db)
    return TaskExtractionResponse(
        status="success",
        transcript=transcript,
        meeting_id=meeting["id"],
        tasks=tasks,
    )

@app.post("/api/process-text", response_model=TaskExtractionResponse)
def process_text(req: TextExtractionRequest, user: CurrentUser = Depends(get_current_user)):
    db = require_db()
    assert_firm_member(user.id, req.firm_id, db)

    if not req.text.strip():
        return TaskExtractionResponse(status="success", transcript="", tasks=[])

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

    tasks = extract_and_queue(req.text, req.firm_id, user.id, meeting["id"], db)
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

    # Load task
    task_res = db.table("tasks").select("*").eq("id", task_id).limit(1).execute()
    if not task_res.data:
        raise HTTPException(status_code=404, detail="Task not found")
    task = task_res.data[0]
    firm_id = task["firm_id"]

    assert_firm_member(user.id, firm_id, db, require_admin=True)

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
        raise HTTPException(status_code=409, detail=f"Task already {task['status']}")

    final_task = body.task or task["task"]
    final_owner = body.owner or task.get("owner") or "Unassigned"
    final_due = clean_due_date(body.due_date) if body.due_date else task.get("due_date")

    # Resolve Trello config
    trello_config_id = body.trello_config_id or task.get("trello_config_id")
    if trello_config_id:
        cfg_res = db.table("firm_trello_configs").select("*").eq("id", trello_config_id).limit(1).execute()
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
    except HTTPException:
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

# ------------------------------------------------------------------
# Optional: keep old admin verify for compatibility (super-admin only)
# ------------------------------------------------------------------
@app.get("/api/admin/verify")
def admin_verify(x_admin_key: Optional[str] = Header(None)):
    if SUPER_ADMIN_KEY and x_admin_key and hmac.compare_digest(x_admin_key, SUPER_ADMIN_KEY):
        return {"status": "ok", "super_admin": True}
    raise HTTPException(status_code=401, detail="Unauthorized")