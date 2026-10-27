"use client";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelative } from "@/lib/utils";
import { Mic } from "lucide-react";

function MeetingsContent() {
  const { session, currentFirm } = useAuth();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  const token = session?.access_token;
  const firmId = currentFirm?.id;

  useEffect(() => {
    if (!token || !firmId) return;
    setLoading(true);
    apiFetch(`/api/meetings?firm_id=${firmId}&limit=50`, {}, token)
      .then((res) => setMeetings(res.meetings || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, firmId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
        <p className="text-slate-400 text-sm mt-1">
          All transcribed sessions for {currentFirm?.name}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Loading…</div>
      ) : meetings.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-slate-500 text-sm">
            No meetings yet
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-5 gap-4">
          <div className="md:col-span-2 space-y-2">
            {meetings.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                className={`w-full text-left p-3.5 rounded-xl border transition-colors ${
                  selected?.id === m.id
                    ? "border-brand-500/40 bg-brand-500/5"
                    : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                    <Mic className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">
                      {m.title || "Untitled"}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatRelative(m.created_at)}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="md:col-span-3">
            {selected ? (
              <Card>
                <CardContent className="py-5 space-y-4">
                  <div>
                    <h2 className="font-medium">
                      {selected.title || "Untitled"}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatRelative(selected.created_at)}
                    </p>
                  </div>
                  <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
                    {selected.transcript || "No transcript available"}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">
                Select a meeting to view transcript
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MeetingsPage() {
  return (
    <AuthProvider>
      <DashboardShell>
        <MeetingsContent />
      </DashboardShell>
    </AuthProvider>
  );
}
