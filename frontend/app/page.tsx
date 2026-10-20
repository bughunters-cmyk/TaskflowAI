'use client';
import { useState, useRef } from 'react';

interface TaskItem {
  task: string;
  owner?: string;
  due_date?: string;
  type: string;
  evidence?: string;
}

export default function Dashboard() {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [statusMsg, setStatusMsg] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Start Mic Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.start();
      setRecording(true);
      setStatusMsg('Recording live meeting audio...');
    } catch (err) {
      setStatusMsg('Error: Microphone access denied.');
    }
  };

  // Stop Recording & Send to Backend
  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setRecording(false);
    setStatusMsg('Processing audio with Sarvam AI & LLM...');

    mediaRecorderRef.current.onstop = async () => {
      // Retain browser audio mime type or fallback to wav
      const mimeType = mediaRecorderRef.current?.mimeType || 'audio/wav';
      const ext = mimeType.includes('webm') ? 'webm' : 'wav';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

      const formData = new FormData();
      formData.append('file', audioBlob, `meeting.${ext}`);

      setLoading(true);
      try {
        const res = await fetch('http://127.0.0.1:8000/api/process-audio', {
          method: 'POST',
          headers: {
            'x-api-secret': process.env.NEXT_PUBLIC_API_SECRET_KEY || '',
          },
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.detail || `Server error ${res.status}`);
        }

        const data = await res.json();
        
        if (data.status === 'duplicate') {
          setStatusMsg('⚠️ Duplicate audio hash detected! Skipped processing.');
          setTranscript('[Duplicate Audio]');
          setTasks([]);
        } else {
          setTranscript(data.transcript || '');
          setTasks(data.tasks || []);
          setStatusMsg('Extraction complete!');
        }
      } catch (err: any) {
        console.error('Processing error:', err);
        setStatusMsg(`Error: ${err.message || 'Cannot reach backend on port 8000'}`);
      } finally {
        setLoading(false);
      }
    };
  };

  // Publish Card to Trello
  const publishToTrello = async (taskItem: TaskItem) => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/create-trello-card', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-secret': process.env.NEXT_PUBLIC_API_SECRET_KEY || '',
        },
        body: JSON.stringify({
          task: taskItem.task,
          owner: taskItem.owner || 'Unassigned',
          due_date: taskItem.due_date || null,
          evidence: taskItem.evidence || '',
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        alert(`Card published to Trello!\nCard URL: ${data.card_url}`);
      } else {
        alert(`Failed to publish card: ${data.detail || 'Check backend logs'}`);
      }
    } catch (err) {
      alert('Failed to publish Trello card.');
    }
  };

  const confirmedTasks = tasks.filter((t) => t.type === 'confirmed');
  const tentativeTasks = tasks.filter((t) => t.type === 'tentative');

  return (
    <main className="min-h-screen bg-slate-900 text-white p-8 max-w-5xl mx-auto space-y-8 font-sans">
      <header className="border-b border-slate-700 pb-4">
        <h1 className="text-3xl font-bold">🎙️ AI Meeting Task Agent</h1>
        <p className="text-slate-400">Live Audio Ingestion ➔ Sarvam STT ➔ LLM Extraction ➔ Trello</p>
      </header>

      {/* Control Panel */}
      <section className="flex items-center gap-4 bg-slate-800 p-6 rounded-xl border border-slate-700">
        {!recording ? (
          <button 
            onClick={startRecording} 
            disabled={loading} 
            className="bg-red-600 hover:bg-red-500 disabled:bg-slate-600 text-white px-6 py-3 rounded-lg font-bold transition"
          >
            🔴 Start Recording
          </button>
        ) : (
          <button 
            onClick={stopRecording} 
            className="bg-slate-600 hover:bg-slate-500 text-white px-6 py-3 rounded-lg font-bold transition"
          >
            ⬛ Stop & Extract Tasks
          </button>
        )}
        <span className="text-slate-300 font-mono">{statusMsg}</span>
      </section>

      {/* Transcript Box */}
      {transcript && (
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h2 className="text-xl font-semibold mb-2">Transcript (Sarvam AI)</h2>
          <p className="text-slate-300 bg-slate-950 p-4 rounded-lg italic">"{transcript}"</p>
        </section>
      )}

      {/* Extracted Tasks View */}
      {tasks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Confirmed Tasks */}
          <div className="bg-slate-800 p-6 rounded-xl border border-green-500/30 space-y-4">
            <h3 className="text-lg font-bold text-green-400">✅ Confirmed Tasks</h3>
            {confirmedTasks.length === 0 ? (
              <p className="text-xs text-slate-500">No confirmed tasks found.</p>
            ) : (
              confirmedTasks.map((t, idx) => (
                <div key={idx} className="bg-slate-950 p-4 rounded-lg space-y-2 border border-slate-800">
                  <p className="font-semibold">{t.task}</p>
                  <p className="text-xs text-slate-400">Owner: {t.owner} | Due: {t.due_date || 'N/A'}</p>
                  {t.evidence && <p className="text-xs text-slate-500 italic">"{t.evidence}"</p>}
                  <button 
                    onClick={() => publishToTrello(t)} 
                    className="w-full bg-green-600 hover:bg-green-500 text-xs text-white py-2 rounded font-bold transition mt-2"
                  >
                    Approve & Create Card
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Tentative Items */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
            <h3 className="text-lg font-bold text-slate-400">💬 Tentative / Ideas</h3>
            {tentativeTasks.length === 0 ? (
              <p className="text-xs text-slate-500">No tentative items found.</p>
            ) : (
              tentativeTasks.map((item, idx) => (
                <div key={idx} className="bg-slate-950 p-4 rounded-lg space-y-1 border border-slate-800">
                  <p className="text-sm font-medium">{item.task}</p>
                  <p className="text-xs text-slate-400">Owner: {item.owner}</p>
                  {item.evidence && <p className="text-xs text-slate-500 italic">"{item.evidence}"</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </main>
  );
}