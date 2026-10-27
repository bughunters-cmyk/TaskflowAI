"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, apiUpload } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Mic,
  ListTodo,
  CheckCircle2,
  AlertCircle,
  Upload,
  FileText,
} from "lucide-react";
import { formatRelative } from "@/lib/utils";

export function OverviewPage() {
  const { session, currentFirm } = useAuth();
  const [stats, setStats] = useState({
    meetings: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [recentMeetings, setRecentMeetings] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showText, setShowText] = useState(false);
  const [message, setMessage] = useState("");

  const token = session?.access_token;
  const firmId = currentFirm?.id;

  const loadData = async () => {
    if (!token || !firmId) return;
    try {
      const [meetingsRes, pendingRes, approvedRes] = await Promise.all([
        apiFetch(`/api/meetings?firm_id=${firmId}&limit=5`, {}, token),
        apiFetch(`/api/tasks?firm_id=${firmId}&status=pending`, {}, token),
        apiFetch(`/api/tasks?firm_id=${firmId}&status=approved`, {}, token),
      ]);
      setRecentMeetings(meetingsRes.meetings || []);
      setStats({
        meetings: meetingsRes.meetings?.length || 0,
        pending: pendingRes.tasks?.length || 0,
        approved: approvedRes.tasks?.length || 0,
        rejected: 0,
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [token, firmId]);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token || !firmId) return;
    setUploading(true);
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiUpload(
        `/api/process-audio?firm_id=${firmId}&title=${encodeURIComponent(file.name)}`,
        fd,
        token
      );
      setMessage(
        res.status === "duplicate"
          ? "Duplicate audio detected"
          : `Extracted ${res.tasks?.length || 0} tasks`
      );
      loadData();
    } catch (err: any) {
      setMessage(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim() || !token || !firmId) return;
    setUploading(true);
    setMessage("");
    try {
      const res = await apiFetch(
        "/api/process-text",
        {
          method: "POST",
          body: JSON.stringify({
            text: textInput,
            firm_id: firmId,
            title: "Text note",
          }),
        },
        token
      );
      setMessage(`Extracted ${res.tasks?.length || 0} tasks`);
      setTextInput("");
      setShowText(false);
      loadData();
    } catch (err: any) {
      setMessage(err.message || "Failed");
    } finally {
      setUploading(false);
    }
  };

  if (!currentFirm) {
    return (
      <div className="text-center py-20 text-slate-400">
        Select or create a firm to get started
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Good {getGreeting()}, {session?.user?.email?.split("@")[0]}
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          {currentFirm.name} · Turn conversations into clear action items
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <label className="cursor-pointer">
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleAudioUpload}
            disabled={uploading}
          />
          <span className="inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 shadow-sm shadow-brand-500/20 transition-colors">
            {uploading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload recording
          </span>
        </label>
        <Button variant="secondary" onClick={() => setShowText(!showText)}>
          <FileText className="w-4 h-4" />
          Paste transcript
        </Button>
      </div>

      {showText && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste meeting notes or transcript here…"
              rows={5}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowText(false)}>
                Cancel
              </Button>
              <Button onClick={handleTextSubmit} loading={uploading}>
                Extract tasks
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {message && (
        <div className="text-sm text-brand-400 bg-brand-500/10 border border-brand-500/20 rounded-lg px-4 py-2.5">
          {message}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Mic}
          label="Recent meetings"
          value={stats.meetings}
          color="text-blue-400"
        />
        <StatCard
          icon={ListTodo}
          label="Pending review"
          value={stats.pending}
          color="text-amber-400"
        />
        <StatCard
          icon={CheckCircle2}
          label="Approved"
          value={stats.approved}
          color="text-brand-400"
        />
        <StatCard
          icon={AlertCircle}
          label="Needs attention"
          value={stats.pending}
          color="text-orange-400"
        />
      </div>

      {/* Recent meetings */}
      <div>
        <h2 className="text-sm font-medium text-slate-400 mb-3">
          Recent meetings
        </h2>
        {recentMeetings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-slate-500 text-sm">
              No meetings yet. Upload a recording to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentMeetings.map((m) => (
              <Card key={m.id}>
                <CardContent className="py-3.5 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">
                      {m.title || "Untitled meeting"}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatRelative(m.created_at)}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 shrink-0 ml-4">
                    {m.transcript
                      ? `${m.transcript.slice(0, 60)}…`
                      : "No transcript"}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-slate-800 ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-semibold">{value}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
