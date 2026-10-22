'use client';

import { useState, useEffect } from 'react';

interface Task {
  id: string;
  task: string;
  owner: string;
  due_date: string | null;
  type: string;
  evidence: string;
  status: string;
  trello_card_url?: string | null;
}

export default function Home() {
  const [text, setText] = useState('Rahul will deploy the backend server tomorrow, and Priya should verify the landing page design.');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [adminKey, setAdminKey] = useState('RZuiKwZZQqTIMDIS5LNZnlens_vXVTEJgaDACmjanEQ');
  const [log, setLog] = useState('');

  const API_URL = 'http://127.0.0.1:8000';

  const fetchPendingTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/tasks?status=pending`, {
        headers: { 'x-admin-key': adminKey }
      });
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err: any) {
      setLog('Error fetching tasks: ' + err.message);
    }
  };

  useEffect(() => {
    fetchPendingTasks();
  }, []);

  const handleExtract = async () => {
    setLoading(true);
    setLog('Extracting tasks via Gemini...');
    try {
      const res = await fetch(`${API_URL}/api/process-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-secret': 'admin123'
        },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Extraction failed');
      setLog(`Success: Extracted ${data.tasks?.length || 0} tasks!`);
      fetchPendingTasks();
    } catch (err: any) {
      setLog('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (taskId: string) => {
    setLog(`Approving task ${taskId}...`);
    try {
      const res = await fetch(`${API_URL}/api/admin/tasks/${taskId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Approval failed');
      setLog(`Trello Card Created! URL: ${data.card_url}`);
      fetchPendingTasks();
    } catch (err: any) {
      setLog('Error approving: ' + err.message);
    }
  };

  const handleReject = async (taskId: string) => {
    setLog(`Rejecting task ${taskId}...`);
    try {
      const res = await fetch(`${API_URL}/api/admin/tasks/${taskId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ reason: 'Rejected from Dashboard', reviewed_by: 'admin' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Rejection failed');
      setLog('Task rejected successfully.');
      fetchPendingTasks();
    } catch (err: any) {
      setLog('Error rejecting: ' + err.message);
    }
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '850px', margin: '0 auto', fontFamily: 'sans-serif', color: '#f8fafc', background: '#0f172a', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#38bdf8' }}>
        ?? ZiroAI Task Extraction Agent
      </h1>

      <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #334155' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>1. Ingest Meeting Notes / Text</h2>
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', background: '#0f172a', color: '#f8fafc', border: '1px solid #475569', boxSizing: 'border-box' }}
        />
        <button
          onClick={handleExtract}
          disabled={loading}
          style={{ marginTop: '0.75rem', padding: '0.6rem 1.2rem', borderRadius: '6px', background: '#0284c7', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Processing...' : 'Extract Tasks'}
        </button>
      </div>

      <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>2. Admin Approval Queue ({tasks.length} Pending)</h2>
          <button
            onClick={fetchPendingTasks}
            style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', background: '#475569', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            Refresh
          </button>
        </div>

        {tasks.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>No pending tasks in queue.</p>
        ) : (
          tasks.map((t) => (
            <div key={t.id} style={{ background: '#0f172a', padding: '1rem', borderRadius: '6px', marginBottom: '0.75rem', border: '1px solid #334155' }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#e2e8f0' }}>{t.task}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Owner: <span style={{ color: '#38bdf8' }}>{t.owner}</span> | Type: <span>{t.type}</span> | Due: <span>{t.due_date || 'None'}</span>
              </div>
              <div style={{ fontStyle: 'italic', color: '#64748b', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                Evidence: "{t.evidence}"
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => handleApprove(t.id)}
                  style={{ padding: '0.4rem 0.9rem', borderRadius: '4px', background: '#16a34a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Approve & Sync Trello
                </button>
                <button
                  onClick={() => handleReject(t.id)}
                  style={{ padding: '0.4rem 0.9rem', borderRadius: '4px', background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer' }}
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#94a3b8' }}>System Status</h3>
        <pre style={{ margin: 0, padding: '0.5rem', background: '#020617', borderRadius: '4px', color: '#a7f3d0', fontSize: '0.85rem', overflowX: 'auto' }}>
          {log || 'System Ready.'}
        </pre>
      </div>
    </main>
  );
}
