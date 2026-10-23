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
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------
# Security Verification
# ------------------------------------------------------------------
def verify_api_secret(x_api_secret: Optional[str] = Header(None)):
    if API_SECRET_KEY and x_api_secret != API_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid API Secret")
    return True

# ------------------------------------------------------------------
# Pydantic Schemas
# ------------------------------------------------------------------
class TaskItem(BaseModel):
    task: str
    owner: Optional[str] = "Unassigned"
    due_date: Optional[str] = None
    type: str = "confirmed"
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
    """Safely extracts JSON even if wrapped in markdown blocks."""
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
            gemini_url = f"[https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=](https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=){GEMINI_API_KEY}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [{
                    "parts": [{"text": f"{system_prompt}\n\nTranscript:\n{transcript}"}]
                }],
                "generationConfig": {
                    "response_mime_type": "application/json",
                    "temperature": 0.1
                }
            }
            resp = requests.post(gemini_url, headers=headers, json=payload, timeout=25)
            if resp.status_code == 200:
                raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                return parse_llm_json(raw_text)
            else:
                print(f"❌ Gemini Native API Error {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"❌ Gemini Exception: {e}")

    if GROQ_API_KEY:
        try:
            groq_url = "[https://api.groq.com/openai/v1/chat/completions](https://api.groq.com/openai/v1/chat/completions)"
            headers = {
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Transcript:\n{transcript}"}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.1
            }
            resp = requests.post(groq_url, headers=headers, json=payload, timeout=25)
            if resp.status_code == 200:
                raw_text = resp.json()["choices"][0]["message"]["content"]
                return parse_llm_json(raw_text)
            else:
                print(f"❌ Groq API Error {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"❌ Groq Exception: {e}")

    return {"tasks": []}

# ------------------------------------------------------------------
# Primary Endpoints
# ------------------------------------------------------------------
@app.post("/api/process-audio", response_model=TaskExtractionResponse)
def process_audio(
    file: UploadFile = File(...),
    authenticated: bool = Depends(verify_api_secret)
):
    try:
        audio_bytes = file.file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    if check_and_store_hash(audio_bytes):
        return TaskExtractionResponse(
            status="duplicate",
            transcript="[Duplicate Audio Detected]",
            tasks=[]
        )

    if not SARVAM_API_KEY:
        raise HTTPException(status_code=500, detail="SARVAM_API_KEY missing from environment.")

    sarvam_url = "https://api.sarvam.ai/speech-to-text-translate"
    sarvam_headers = {"api-subscription-key": SARVAM_API_KEY}
    
    file.file.seek(0)
    clean_mime = (file.content_type or "audio/wav").split(";")[0]
    files = {"file": (file.filename, file.file, clean_mime)}

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

    extraction_result = call_llm_extraction(transcript)
    raw_tasks = extraction_result.get("tasks", [])

    formatted_tasks = []
    if isinstance(raw_tasks, list):
        for t in raw_tasks:
            if isinstance(t, dict):
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
    if not TRELLO_API_KEY or not TRELLO_TOKEN or not TRELLO_LIST_ID:
        raise HTTPException(status_code=500, detail="Trello API configuration missing.")

    trello_url = "[https://api.trello.com/1/cards](https://api.trello.com/1/cards)"
    
    description_content = (
        f"**Assigned Owner:** {card.owner or 'Unassigned'}\n\n"
        f"**Evidence Quote:** *\"{card.evidence or 'N/A'}\"*"
    )
    
    params = {
        "key": TRELLO_API_KEY,
        "token": TRELLO_TOKEN,
        "idList": TRELLO_LIST_ID,
        "name": f"[{card.owner or 'Unassigned'}] {card.task}",
        "desc": description_content
    }
    
    if card.due_date:
        params["due"] = f"{card.due_date}T12:00:00.000Z"

    try:
        resp = requests.post(trello_url, params=params, timeout=15)
        if resp.status_code == 200:
            card_data = resp.json()
            
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
