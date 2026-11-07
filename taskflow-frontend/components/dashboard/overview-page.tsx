"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Mic,
  ListTodo,
  CheckCircle2,
  Upload,
  FileText,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

// Prefer shared util; fall back if the project utils file is incomplete
function formatRelativeSafe(date: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { formatRelative } = require("@/lib/utils");
    if (typeof formatRelative === "function") return formatRelative(date);
  } catch {
    /* ignore */
  }
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function uploadAudio(path: string, formData: FormData, token: string) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export function OverviewPage() {
  const { session, currentFirm, firms } = useAuth();
  const [stats, setStats] = useState({ meetings: 0, pending: 0, approved: 0 });
  const [recentMeetings, setRecentMeetings] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showText, setShowText] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [LiveRec, setLiveRec] = useState<null | React.ComponentType<any>>(null);

  const token = session?.access_token;
  const firmId = currentFirm?.id;
  const name = session?.user?.email?.split("@")[0] || "there";

  // Load LiveRecorder only if the file exists — never crash Overview if it's missing
  useEffect(() => {
    import("@/components/dashboard/live-recorder")
      .then((m) => setLiveRec(() => m.LiveRecorder))
      .catch(() => setLiveRec(null));
  }, []);

  const loadData = async () => {
    if (!token || !firmId) return;
    try {
      const [meetingsRes, pendingRes, approvedRes] = await Promise.all([
        apiFetch(`/api/meetings?firm_id=${firmId}&limit=8`, {}, token),
        apiFetch(`/api/tasks?firm_id=${firmId}&status=pending`, {}, token),
        apiFetch(`/api/tasks?firm_id=${firmId}&status=approved`, {}, token),
      ]);
      setRecentMeetings(meetingsRes.meetings || []);
      setStats({
        meetings: (meetingsRes.meetings || []).length,
        pending: (pendingRes.tasks || []).length,
        approved: (approvedRes.tasks || []).length,
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
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadAudio(
        `/api/process-audio?firm_id=${firmId}&title=${encodeURIComponent(file.name)}`,
        fd,
        token
      );
      setMessage({
        type: "ok",
        text:
          res.status === "duplicate"
            ? "Duplicate audio detected — already processed."
            : `Extracted ${res.tasks?.length || 0} task${(res.tasks?.length || 0) === 1 ? "" : "s"}.`,
      });
      loadData();
    } catch (err: any) {
      setMessage({ type: "err", text: err.message || "Upload failed" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim() || !token || !firmId) return;
    setUploading(true);
    setMessage(null);
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
      setMessage({
        type: "ok",
        text: `Extracted ${res.tasks?.length || 0} task${(res.tasks?.length || 0) === 1 ? "" : "s"}.`,
      });
      setTextInput("");
      setShowText(false);
      loadData();
    } catch (err: any) {
      setMessage({ type: "err", text: err.message || "Failed" });
    } finally {
      setUploading(false);
    }
  };

  if (!currentFirm) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-sm text-slate-400">
          {firms?.length
            ? "Select a firm from the sidebar switcher."
            : "No firm selected. Create or join a firm from Settings / Firms."}
        </p>
        <Link href="/settings" className="text-sm text-emerald-400 hover:underline">
          Go to Settings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.08] via-transparent to-sky-500/[0.05] p-6 md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
              <Sparkles className="h-3 w-3" />
              {currentFirm.name}
            </div>
            <h1 className="text-[26px] font-semibold tracking-tight text-white md:text-[28px]">
              Good {getGreeting()}, {name}
            </h1>
            <p className="mt-1.5 max-w-md text-[13px] text-slate-400">
              Capture meetings, extract action items, and push them to Trello.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleAudioUpload}
                disabled={uploading}
              />
              <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-[13px] font-medium text-white hover:bg-emerald-600">
                {uploading ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Upload recording
              </span>
            </label>
            <Button variant="secondary" size="sm" onClick={() => setShowText((v) => !v)} className="h-10">
              <FileText className="h-3.5 w-3.5" />
              Paste transcript
            </Button>
          </div>
        </div>
      </div>

      {LiveRec && (
        <LiveRec
          onDone={({ message: msg }: { message: string }) => {
            setMessage({ type: "ok", text: msg });
            loadData();
          }}
        />
      )}

      {showText && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste meeting notes…"
            rows={5}
            className="w-full resize-none rounded-lg border border-white/[0.08] bg-[#07090f] px-3 py-2.5 text-[13px] text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/40 focus:outline-none"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowText(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleTextSubmit} loading={uploading}>
              Extract tasks
            </Button>
          </div>
        </div>
      )}

      {message && (
        <div
          className={
            message.type === "ok"
              ? "rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-[13px] text-emerald-400"
              : "rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-[13px] text-red-400"
          }
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat icon={Mic} label="Meetings" value={stats.meetings} />
        <Stat icon={ListTodo} label="Pending review" value={stats.pending} />
        <Stat icon={CheckCircle2} label="Approved" value={stats.approved} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-medium text-slate-400">Recent meetings</h2>
          <Link href="/meetings" className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-emerald-400">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentMeetings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.08] py-16 text-center">
            <p className="text-[14px] font-medium text-slate-300">No meetings yet</p>
            <p className="mt-1 text-[12px] text-slate-500">Upload audio or paste a transcript to start.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
            {recentMeetings.map((m, i) => (
              <div
                key={m.id}
                className={
                  "flex items-center gap-4 px-4 py-3.5 " +
                  (i !== 0 ? "border-t border-white/[0.04]" : "")
                }
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                  <Mic className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-slate-100">
                    {m.title || "Untitled meeting"}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {formatRelativeSafe(m.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[22px] font-semibold tabular-nums leading-none text-white">{value}</div>
          <div className="mt-1 text-[11px] text-slate-500">{label}</div>
        </div>
      </div>
    </div>
  );
}
