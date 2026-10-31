"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, apiUpload } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Mic,
  ListTodo,
  CheckCircle2,
  AlertCircle,
  Upload,
  FileText,
  ArrowRight,
} from "lucide-react";
import { formatRelative } from "@/lib/utils";
import Link from "next/link";

export function OverviewPage() {
  const { session, currentFirm } = useAuth();
  const [stats, setStats] = useState({
    meetings: 0,
    pending: 0,
    approved: 0,
  });
  const [recentMeetings, setRecentMeetings] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showText, setShowText] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const token = session?.access_token;
  const firmId = currentFirm?.id;

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
      const res = await apiUpload(
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
      <div className="py-24 text-center text-sm text-slate-500">
        Select or create a firm to get started
      </div>
    );
  }

  const name = session?.user?.email?.split("@")[0] || "there";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-white">
            Good {getGreeting()}, {name}
          </h1>
          <p className="mt-1 text-[13px] text-slate-500">
            {currentFirm.name} · Turn conversations into clear action items
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleAudioUpload}
              disabled={uploading}
            />
            <span className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-500 px-3.5 text-[13px] font-medium text-white shadow-sm shadow-emerald-500/20 transition hover:bg-emerald-600">
              {uploading ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Upload recording
            </span>
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowText((v) => !v)}
            className="h-9"
          >
            <FileText className="h-3.5 w-3.5" />
            Paste transcript
          </Button>
        </div>
      </div>

      {/* Paste transcript panel */}
      {showText && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste meeting notes or a transcript…"
            rows={5}
            className="w-full resize-none rounded-md border border-white/[0.08] bg-[#0a0e17] px-3 py-2.5 text-[13px] text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
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

      {/* Status message */}
      {message && (
        <div
          className={
            message.type === "ok"
              ? "rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] text-emerald-400"
              : "rounded-md border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-400"
          }
        >
          {message.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          icon={Mic}
          label="Meetings"
          value={stats.meetings}
          accent="text-sky-400"
          accentBg="bg-sky-400/10"
        />
        <StatCard
          icon={ListTodo}
          label="Pending review"
          value={stats.pending}
          accent="text-amber-400"
          accentBg="bg-amber-400/10"
        />
        <StatCard
          icon={CheckCircle2}
          label="Approved"
          value={stats.approved}
          accent="text-emerald-400"
          accentBg="bg-emerald-400/10"
        />
      </div>

      {/* Recent meetings */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-medium text-slate-400">Recent meetings</h2>
          {recentMeetings.length > 0 && (
            <Link
              href="/meetings"
              className="inline-flex items-center gap-1 text-[12px] text-slate-500 transition hover:text-slate-300"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {recentMeetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.08] py-14 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04]">
              <Mic className="h-4 w-4 text-slate-500" />
            </div>
            <p className="text-[13px] font-medium text-slate-400">No meetings yet</p>
            <p className="mt-1 max-w-xs text-[12px] text-slate-600">
              Upload a recording or paste a transcript to extract action items.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/[0.06]">
            {recentMeetings.map((m, i) => (
              <div
                key={m.id}
                className={
                  "flex items-center gap-4 px-4 py-3.5 transition hover:bg-white/[0.02] " +
                  (i !== 0 ? "border-t border-white/[0.04]" : "")
                }
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.04]">
                  <Mic className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-slate-200">
                    {m.title || "Untitled meeting"}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {formatRelative(m.created_at)}
                  </div>
                </div>
                <div className="hidden max-w-[280px] truncate text-[12px] text-slate-500 sm:block">
                  {m.transcript
                    ? m.transcript.slice(0, 80) + (m.transcript.length > 80 ? "…" : "")
                    : "No transcript"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  accentBg,
}: {
  icon: any;
  label: string;
  value: number;
  accent: string;
  accentBg: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${accentBg}`}>
          <Icon className={`h-4 w-4 ${accent}`} strokeWidth={1.75} />
        </div>
        <div>
          <div className="text-[20px] font-semibold tabular-nums leading-none text-white">
            {value}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
