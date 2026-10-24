import os
import hmac
import hashlib
import json
from datetime import datetime, timezone
from typing import List, Optional
from pathlib import Path
from dotenv import load_dotenv

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
from supabase import create_client, Client

# ------------------------------------------------------------------
# Environment Setup
# ------------------------------------------------------------------
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
TRELLO_API_KEY = os.getenv("TRELLO_API_KEY")
TRELLO_TOKEN = os.getenv("TRELLO_TOKEN")
TRELLO_LIST_ID = os.getenv("TRELLO_LIST_ID")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
API_SECRET_KEY = os.getenv("API_SECRET_KEY")      # for submitting audio/text
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY")     
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
GROQ_LLM_MODEL = os.getenv("GROQ_LLM_MODEL", "")   # NEW: for approve/reject/list (never expose via NEXT_PUBLIC_)
FRONTEND_ORIGINS = [o.strip() for o in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")]

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"⚠️ Supabase initialization failed: {e}")

app = FastAPI(title="AI Task Extraction Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------
# Auth
# ------------------------------------------------------------------
def verify_api_secret(x_api_secret: Optional[str] = Header(None)):
    if API_SECRET_KEY and x_api_secret != API_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid API Secret")
    return True

def verify_admin(x_admin_key: Optional[str] = Header(None)):
    """Admin-only gate. Fails closed if ADMIN_API_KEY isn't configured."""
    if not ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin access not configured on server.")
    if not x_admin_key or not hmac.compare_digest(x_admin_key, ADMIN_API_KEY):
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid admin key")
    return True

def require_db() -> Client:
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured; approval queue unavailable.")
    return supabase

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

class TaskExtractionResponse(BaseModel):
    status: str
    transcript: str
    tasks: List[TaskItem]

class TextExtractionRequest(BaseModel):
    text: str

class ApproveRequest(BaseModel):
    # Optional admin edits applied at approval time
    task: Optional[str] = None
    owner: Optional[str] = None
    due_date: Optional[str] = None
    reviewed_by: Optional[str] = "admin"

class RejectRequest(BaseModel):
    reason: Optional[str] = None
    reviewed_by: Optional[str] = "admin"

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def check_and_store_hash(audio_bytes: bytes) -> bool:
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
                json=payload, timeout=25,
            )
            if resp.status_code == 200:
                return parse_llm_json(resp.json()["choices"][0]["message"]["content"])
            print(f"❌ Groq API Error {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"❌ Groq Exception: {e}")

    raise HTTPException(status_code=502, detail="Both AI providers failed to extract tasks. Check the backend logs.")

def clean_due_date(value) -> Optional[str]:
    """LLMs sometimes return 'null', '' or garbage; keep only valid YYYY-MM-DD."""
    if not value or not isinstance(value, str):
        return None
    try:
        datetime.strptime(value.strip(), "%Y-%m-%d")
        return value.strip()
    except ValueError:
        return None

def extract_and_queue(transcript: str) -> List[TaskItem]:
    """Run LLM extraction and persist each task as 'pending' for admin review."""
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

    '''if supabase:
        try:
            saved = supabase.table("pending_tasks").insert(rows).execute().data
            return [TaskItem(**{k: r.get(k) for k in TaskItem.model_fields if k in r}) for r in saved]
        except Exception as e:
            print(f"⚠️ Failed to queue tasks: {e}")
    # No DB: return unsaved (can't be approved)
    return [TaskItem(**{k: v for k, v in r.items() if k in TaskItem.model_fields}) for r in rows]'''
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured; cannot queue tasks for approval.")
    try:
        saved = supabase.table("pending_tasks").insert(rows).execute().data
    except Exception as e:
        print(f"⚠️ Failed to queue tasks: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save tasks to the approval queue: {e}")
    return [TaskItem(**{k: r.get(k) for k in TaskItem.model_fields if k in r}) for r in saved]

def create_trello_card(task: str, owner: str, due_date: Optional[str], evidence: str) -> dict:
    if not TRELLO_API_KEY or not TRELLO_TOKEN or not TRELLO_LIST_ID:
        raise HTTPException(status_code=500, detail="Trello API configuration missing.")
    params = {
        "key": TRELLO_API_KEY,
        "token": TRELLO_TOKEN,
        "idList": TRELLO_LIST_ID,
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
# Submission endpoints (extraction -> pending queue)
# ------------------------------------------------------------------
@app.post("/api/process-audio", response_model=TaskExtractionResponse)
def process_audio(file: UploadFile = File(...), authenticated: bool = Depends(verify_api_secret)):
    try:
        audio_bytes = file.file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    if check_and_store_hash(audio_bytes):
        return TaskExtractionResponse(status="duplicate", transcript="[Duplicate Audio Detected]", tasks=[])

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
                print(f"⚠️ Sarvam STT failed ({resp.status_code}). Falling back to Groq...")
        except Exception as e:
            print(f"⚠️ Sarvam API network error: {e}. Falling back to Groq...")

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
            raise HTTPException(status_code=500, detail=f"STT Pipeline failed entirely: {e}")

    if not transcript:
        return TaskExtractionResponse(status="success", transcript="", tasks=[])

    return TaskExtractionResponse(status="success", transcript=transcript, tasks=extract_and_queue(transcript))

@app.post("/api/process-text", response_model=TaskExtractionResponse)
def process_text(req: TextExtractionRequest, authenticated: bool = Depends(verify_api_secret)):
    if not req.text.strip():
        return TaskExtractionResponse(status="success", transcript="", tasks=[])
    return TaskExtractionResponse(status="success", transcript=req.text, tasks=extract_and_queue(req.text))

# ------------------------------------------------------------------
# Admin approval endpoints
# ------------------------------------------------------------------
@app.get("/api/admin/verify")
def admin_verify(_: bool = Depends(verify_admin)):
    return {"status": "ok"}

@app.get("/api/admin/tasks")
def list_tasks(
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

@app.post("/api/admin/tasks/{task_id}/approve")
def approve_task(task_id: str, body: ApproveRequest):
    db = require_db()

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
        card = create_trello_card(final_task, final_owner, final_due, row.get("evidence") or "")
    except HTTPException:
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

@app.post("/api/admin/tasks/{task_id}/reject")
def reject_task(task_id: str, body: RejectRequest, _: bool = Depends(verify_admin)):
    db = require_db()
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