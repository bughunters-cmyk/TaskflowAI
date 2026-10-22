'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface TaskItem {
  id?: string;
  task: string;
  owner?: string;
  due_date?: string | null;
  type: string;
  evidence?: string;
  status?: string;
  trello_card_url?: string | null;
  rejection_reason?: string | null;
}

type QueueTab = 'pending' | 'approved' | 'rejected';

export default function Dashboard() {
  // ---------------- Submission state ----------------
  const [mode, setMode] = useState<'record' | 'upload' | 'text'>('record');
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manualText, setManualText] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // ---------------- Admin state ----------------
  const [adminKey, setAdminKey] = useState('');
  const [adminInput, setAdminInput] = useState('');
  const [reviewerName, setReviewerName] = useState('admin');
  const [adminError, setAdminError] = useState('');
  const [queueTab, setQueueTab] = useState<QueueTab>('pending');
  const [queue, setQueue] = useState<TaskItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { task?: string; owner?: string; due_date?: string }>>({});

  const submitHeaders = (json = false): Record<string, string> => ({
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    'x-api-secret': process.env.NEXT_PUBLIC_API_SECRET_KEY || '',
  });
  const adminHeaders = (key = adminKey): Record<string, string> => ({
    'Content-Type': 'application/json',
    'x-admin-key': key,
  });

  // ----------------------------------------------------------------
  // Admin login (key lives in sessionStorage only, never in the bundle)
  // ----------------------------------------------------------------
  useEffect(() => {
    const saved = sessionStorage.getItem('admin_key');
    const name = sessionStorage.getItem('reviewer_name');
    if (name) setReviewerName(name);
    if (saved) setAdminKey(saved);
  }, []);

  const adminLogin = async () => {
    setAdminError('');
    try {
      const res = await fetch(`${API}/api/admin/verify`, { headers: adminHeaders(adminInput) });
      if (!res.ok) throw new Error('Invalid admin key');
      sessionStorage.setItem('admin_key', adminInput);
      sessionStorage.setItem('reviewer_name', reviewerName);
      setAdminKey(adminInput);
      setAdminInput('');
    } catch (e: any) {
      setAdminError(e.message || 'Login failed');
    }
  };

  const adminLogout = () => {
    sessionStorage.removeItem('admin_key');
    setAdminKey('');
    setQueue([]);
  };

  const loadQueue = useCallback(async () => {
    if (!adminKey) return;
    setQueueLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/tasks?status=${queueTab}`, { headers: adminHeaders() });
      if (res.status === 401) {
        adminLogout();
        setAdminError('Session invalid. Please log in again.');
        return;
      }
      const data = await res.json();
      setQueue(data.tasks || []);
    } catch {
      setAdminError('Could not load queue.');
    } finally {
      setQueueLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey, queueTab]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const approve = async (t: TaskItem) => {
    if (!t.id) return;
    setBusyId(t.id);
    try {
      const res = await fetch(`${API}/api/admin/tasks/${t.id}/approve`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ ...edits[t.id], reviewed_by: reviewerName }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg(`✅ Approved. Trello card: ${data.card_url}`);
        await loadQueue();
      } else {
        setStatusMsg(`❌ ${data.detail || 'Approval failed'}`);
        await loadQueue();
      }
    } catch {
      setStatusMsg('❌ Network error while approving.');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (t: TaskItem) => {
    if (!t.id) return;
    const reason = window.prompt('Reason for rejecting (optional):') ?? undefined;
    setBusyId(t.id);
    try {
      const res = await fetch(`${API}/api/admin/tasks/${t.id}/reject`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ reason, reviewed_by: reviewerName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setStatusMsg(`❌ ${data?.detail || 'Reject failed'}`);
      }
      await loadQueue();
    } finally {
      setBusyId(null);
    }
  };

  const setEdit = (id: string, field: 'task' | 'owner' | 'due_date', value: string) =>
    setEdits((p) => ({ ...p, [id]: { ...p[id], [field]: value } }));

  // ----------------------------------------------------------------
  // Audio recording
  // ----------------------------------------------------------------
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.start();
      setRecording(true);
      setAudioBlob(null);
      setStatusMsg('Recording live meeting audio...');
    } catch {
      setStatusMsg('Error: Microphone access denied.');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.onstop = async () => {
      const mimeType = mediaRecorderRef.current?.mimeType || 'audio/wav';
      const ext = mimeType.includes('webm') ? 'webm' : 'wav';
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      setAudioBlob(blob);
      const formData = new FormData();
      formData.append('file', blob, `meeting.${ext}`);
      await submitAudio(formData);
    };
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    setRecording(false);
    setStatusMsg('Processing audio with AI...');
  };

  const downloadRecording = () => {
    if (!audioBlob) return;
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-recording-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ----------------------------------------------------------------
  // Submission
  // ----------------------------------------------------------------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMsg(`Processing uploaded file: ${file.name}...`);
    const formData = new FormData();
    formData.append('file', file);
    await submitAudio(formData);
  };

  const handleTextSubmit = async () => {
    if (!manualText.trim()) return;
    setLoading(true);
    setStatusMsg('Extracting tasks from text...');
    try {
      const res = await fetch(`${API}/api/process-text`, {
        method: 'POST',
        headers: submitHeaders(true),
        body: JSON.stringify({ text: manualText }),
      });
      await handleBackendResponse(res);
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
      setLoading(false);
    }
  };

  const submitAudio = async (formData: FormData) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/process-audio`, {
        method: 'POST',
        headers: submitHeaders(),
        body: formData,
      });
      await handleBackendResponse(res);
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
      setLoading(false);
    }
  };

  const handleBackendResponse = async (res: Response) => {
    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.detail || `Server error ${res.status}`);
    }
    const data = await res.json();
    if (data.status === 'duplicate') {
      setStatusMsg('⚠️ Duplicate audio detected! Skipped processing.');
      setTranscript('[Duplicate Audio]');
    } else {
      setTranscript(data.transcript || '');
      const n = (data.tasks || []).length;
      setStatusMsg(`Extraction complete: ${n} task(s) sent to the admin approval queue.`);
      if (adminKey) setQueueTab('pending'), loadQueue();
    }
    setLoading(false);
  };

  // ----------------------------------------------------------------
  // UI
  // ----------------------------------------------------------------
  const inputCls = 'bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white w-full';

  return (
    <main className="min-h-screen bg-slate-900 text-white p-8 max-w-5xl mx-auto space-y-8 font-sans">
      <header className="border-b border-slate-700 pb-4">
        <h1 className="text-3xl font-bold">🎙️ AI Meeting Task Agent</h1>
        <p className="text-slate-400">Audio Ingestion ➔ AI Extraction ➔ Admin Approval ➔ Trello</p>
      </header>

      <div className="flex gap-4">
        {(['record', 'upload', 'text'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 rounded-lg font-semibold transition ${mode === m ? 'bg-blue-600' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)} Mode
          </button>
        ))}
      </div>

      <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
        {mode === 'record' && (
          <div className="flex items-center gap-4">
            {!recording ? (
              <button onClick={startRecording} disabled={loading} className="bg-red-600 hover:bg-red-500 disabled:bg-slate-600 px-6 py-3 rounded-lg font-bold">
                🔴 Start Recording
              </button>
            ) : (
              <button onClick={stopRecording} className="bg-slate-600 hover:bg-slate-500 px-6 py-3 rounded-lg font-bold">
                ⬛ Stop & Extract Tasks
              </button>
            )}
            {audioBlob && (
              <button onClick={downloadRecording} className="bg-blue-600 hover:bg-blue-500 px-4 py-3 rounded-lg font-bold">
                💾 Download Audio
              </button>
            )}
          </div>
        )}

        {mode === 'upload' && (
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">Upload existing meeting audio (.wav, .mp3, .webm)</label>
            <input type="file" accept="audio/*" onChange={handleFileUpload} disabled={loading} className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500" />
          </div>
        )}

        {mode === 'text' && (
          <div className="space-y-4">
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Paste meeting transcript or notes here..."
              className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-4 text-white focus:outline-none focus:border-blue-500"
            />
            <button onClick={handleTextSubmit} disabled={loading || !manualText.trim()} className="bg-green-600 hover:bg-green-500 disabled:bg-slate-600 px-6 py-3 rounded-lg font-bold">
              Extract Tasks from Text
            </button>
          </div>
        )}

        <div className="text-slate-300 font-mono text-sm">{statusMsg}</div>
      </section>

      {transcript && (
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h2 className="text-xl font-semibold mb-2">Generated Transcript</h2>
          <p className="text-slate-300 bg-slate-950 p-4 rounded-lg italic">"{transcript}"</p>
        </section>
      )}

      {/* ------------------ Admin Approval Queue ------------------ */}
      <section className="bg-slate-800 p-6 rounded-xl border border-blue-500/30 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-blue-400">🛡️ Admin Approval Queue</h3>
          {adminKey && (
            <div className="flex gap-2 items-center text-xs text-slate-400">
              <span>Reviewer: {reviewerName}</span>
              <button onClick={loadQueue} className="underline">Refresh</button>
              <button onClick={adminLogout} className="underline">Log out</button>
            </div>
          )}
        </div>

        {!adminKey ? (
          <div className="space-y-3 max-w-sm">
            <input className={inputCls} placeholder="Your name" value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} />
            <input className={inputCls} type="password" placeholder="Admin key" value={adminInput} onChange={(e) => setAdminInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adminLogin()} />
            <button onClick={adminLogin} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-bold text-sm">Unlock</button>
            {adminError && <p className="text-xs text-red-400">{adminError}</p>}
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              {(['pending', 'approved', 'rejected'] as QueueTab[]).map((tab) => (
                <button key={tab} onClick={() => setQueueTab(tab)} className={`px-3 py-1 rounded text-sm ${queueTab === tab ? 'bg-blue-600' : 'bg-slate-700 text-slate-300'}`}>
                  {tab}
                </button>
              ))}
            </div>

            {queueLoading ? (
              <p className="text-xs text-slate-500">Loading…</p>
            ) : queue.length === 0 ? (
              <p className="text-xs text-slate-500">Nothing {queueTab}.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {queue.map((t) => {
                  const e = (t.id && edits[t.id]) || {};
                  const pending = queueTab === 'pending';
                  return (
                    <div key={t.id} className="bg-slate-950 p-4 rounded-lg space-y-2 border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${t.type === 'confirmed' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>{t.type}</span>
                      </div>

                      {pending && t.id ? (
                        <>
                          <input className={inputCls} value={e.task ?? t.task} onChange={(ev) => setEdit(t.id!, 'task', ev.target.value)} />
                          <div className="flex gap-2">
                            <input className={inputCls} placeholder="Owner" value={e.owner ?? t.owner ?? ''} onChange={(ev) => setEdit(t.id!, 'owner', ev.target.value)} />
                            <input className={inputCls} type="date" value={e.due_date ?? t.due_date ?? ''} onChange={(ev) => setEdit(t.id!, 'due_date', ev.target.value)} />
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold">{t.task}</p>
                          <p className="text-xs text-slate-400">Owner: {t.owner} | Due: {t.due_date || 'N/A'}</p>
                        </>
                      )}

                      {t.evidence && <p className="text-xs text-slate-500 italic">"{t.evidence}"</p>}

                      {pending && t.id && (
                        <div className="flex gap-2 pt-1">
                          <button disabled={busyId === t.id} onClick={() => approve(t)} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-xs py-2 rounded font-bold">
                            {busyId === t.id ? 'Working…' : 'Approve & Create Trello Card'}
                          </button>
                          <button disabled={busyId === t.id} onClick={() => reject(t)} className="bg-slate-700 hover:bg-red-700 disabled:bg-slate-600 text-xs px-3 py-2 rounded font-bold">
                            Reject
                          </button>
                        </div>
                      )}
                      {t.trello_card_url && (
                        <a href={t.trello_card_url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 underline">Open Trello card</a>
                      )}
                      {t.rejection_reason && <p className="text-xs text-red-400">Reason: {t.rejection_reason}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
