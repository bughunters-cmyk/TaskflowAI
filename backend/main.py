import os
import hashlib
import json
from datetime import datetime
from typing import List, Optional
from pathlib import Path
from dotenv import load_dotenv

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
from supabase import create_client, Client

# ------------------------------------------------------------------
# Environment Setup
# ------------------------------------------------------------------
# Explicitly resolve .env path relative to this file
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
API_SECRET_KEY = os.getenv("API_SECRET_KEY")

# Initialize Supabase Client
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"⚠️ Supabase initialization failed: {e}")

app = FastAPI(title="AI Task Extraction Agent API")

# ------------------------------------------------------------------
# CORS Middleware Configuration
# ------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Swap with exact Vercel frontend URL in production
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------
# Security Verification
# ------------------------------------------------------------------
def verify_api_secret(x_api_secret: Optional[str] = Header(None)):
    """Simple shared secret check for production API protection."""
    if API_SECRET_KEY and x_api_secret != API_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid API Secret")
    return True

# ------------------------------------------------------------------
# Pydantic Schemas
# ------------------------------------------------------------------
class TaskItem(BaseModel):
    task: str
    owner: Optional[str] = "Unassigned"
    due_date: Optional[str] = None  # Expected format: YYYY-MM-DD
    type: str = "confirmed"         # "confirmed" or "tentative"
    evidence: Optional[str] = ""

class TaskExtractionResponse(BaseModel):
    status: str
    transcript: str
    tasks: List[TaskItem]

class TrelloCardRequest(BaseModel):
    task: str
    owner: Optional[str] = "Unassigned"
    due_date: Optional[str] = None
    evidence: Optional[str] = ""

# ------------------------------------------------------------------
# Deduplication & LLM Extraction Helpers
# ------------------------------------------------------------------
def check_and_store_hash(audio_bytes: bytes) -> bool:
    """Computes SHA-256 and verifies against persistent Supabase database."""
    audio_hash = hashlib.sha256(audio_bytes).hexdigest()
    
    if supabase:
        try:
            res = supabase.table("audio_hashes").select("hash").eq("hash", audio_hash).execute()
            if res.data and len(res.data) > 0:
                return True  # Hash already exists
            
            supabase.table("audio_hashes").insert({"hash": audio_hash}).execute()
        except Exception as e:
            print(f"⚠️ Supabase deduplication error: {e}")
            
    return False

def call_llm_extraction(transcript: str) -> dict:
    """Extracts structured task JSON using Gemini with Groq as fallback."""
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

    providers = [
        {
            "name": "Gemini",
            "url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            "key": GEMINI_API_KEY,
            "model": "gemini-2.0-flash"
        },
        {
            "name": "Groq",
            "url": "https://api.groq.com/openai/v1/chat/completions",
            "key": GROQ_API_KEY,
            "model": "llama-3.3-70b-versatile"
        }
    ]

    for provider in providers:
        if not provider["key"]:
            continue

        try:
            headers = {
                "Authorization": f"Bearer {provider['key']}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": provider["model"],
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Transcript:\n{transcript}"}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.1
            }

            resp = requests.post(provider["url"], headers=headers, json=payload, timeout=25)
            if resp.status_code == 200:
                content = resp.json()["choices"][0]["message"]["content"]
                return json.loads(content)
            else:
                print(f"❌ {provider['name']} HTTP Error {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"❌ Exception in {provider['name']}: {e}")

    return {"tasks": []}

# ------------------------------------------------------------------
# Primary Endpoints
# ------------------------------------------------------------------
@app.post("/api/process-audio", response_model=TaskExtractionResponse)
def process_audio(
    file: UploadFile = File(...),
    authenticated: bool = Depends(verify_api_secret)
):
    """
    Synchronous 'def' endpoint allowing FastAPI to manage execution on worker threads.
    Handles hash deduplication, Sarvam STT, and LLM fallback parsing.
    """
    try:
        audio_bytes = file.file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    # 1. Deduplication check
    if check_and_store_hash(audio_bytes):
        return TaskExtractionResponse(
            status="duplicate",
            transcript="[Duplicate Audio Detected]",
            tasks=[]
        )

    # 2. Sarvam Speech-to-Text
    if not SARVAM_API_KEY:
        raise HTTPException(status_code=500, detail="SARVAM_API_KEY missing from environment.")

    sarvam_url = "https://api.sarvam.ai/speech-to-text-translate"
    sarvam_headers = {"api-subscription-key": SARVAM_API_KEY}
    
    file.file.seek(0)
    files = {"file": (file.filename, file.file, file.content_type or "audio/wav")}

    try:
        sarvam_resp = requests.post(sarvam_url, headers=sarvam_headers, files=files, timeout=45)
        if sarvam_resp.status_code != 200:
            raise HTTPException(
                status_code=500, 
                detail=f"Sarvam STT failed ({sarvam_resp.status_code}): {sarvam_resp.text}"
            )
        
        transcript = sarvam_resp.json().get("transcript", "")
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Sarvam API network error: {e}")

    if not transcript:
        return TaskExtractionResponse(status="success", transcript="", tasks=[])

    # 3. Task Extraction Engine
    extraction_result = call_llm_extraction(transcript)
    raw_tasks = extraction_result.get("tasks", [])

    formatted_tasks = []
    for t in raw_tasks:
        formatted_tasks.append(
            TaskItem(
                task=t.get("task", "Unspecified Action Item"),
                owner=t.get("owner") or "Unassigned",
                due_date=t.get("due_date"),
                type=t.get("type", "confirmed"),
                evidence=t.get("evidence", "")
            )
        )

    return TaskExtractionResponse(
        status="success",
        transcript=transcript,
        tasks=formatted_tasks
    )


@app.post("/api/create-trello-card")
def create_trello_card(
    card: TrelloCardRequest,
    authenticated: bool = Depends(verify_api_secret)
):
    """Creates a card on the specified Trello board/list via REST API."""
    if not TRELLO_API_KEY or not TRELLO_TOKEN or not TRELLO_LIST_ID:
        raise HTTPException(status_code=500, detail="Trello API configuration missing.")

    trello_url = "https://api.trello.com/1/cards"
    
    description_content = (
        f"**Assigned Owner:** {card.owner or 'Unassigned'}\n\n"
        f"**Evidence Quote:** *\"{card.evidence or 'N/A'}\"*"
    )
    
    params = {
        "key": TRELLO_API_KEY,
        "token": TRELLO_TOKEN,
        "idList": TRELLO_LIST_ID,
        "name": f"[{card.owner or 'Unassigned'}] {card.task}",
        "desc": description_content,
        "due": f"{card.due_date}T12:00:00.000Z" if card.due_date else None
    }

    try:
        resp = requests.post(trello_url, params=params, timeout=15)
        if resp.status_code == 200:
            card_data = resp.json()
            
            # Audit log into Supabase if connected
            if supabase:
                try:
                    supabase.table("published_tasks").insert({
                        "trello_card_id": card_data.get("id"),
                        "task": card.task,
                        "owner": card.owner,
                        "published_at": datetime.utcnow().isoformat()
                    }).execute()
                except Exception as audit_err:
                    print(f"⚠️ Audit logging error: {audit_err}")

            return {
                "status": "success",
                "card_id": card_data.get("id"),
                "card_url": card_data.get("url")
            }
        else:
            raise HTTPException(
                status_code=500, 
                detail=f"Trello API error ({resp.status_code}): {resp.text}"
            )
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Trello network error: {e}")