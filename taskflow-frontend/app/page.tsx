"use client";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Check, X, ExternalLink } from "lucide-react";

function TasksContent() {
  const { session, currentFirm } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">(
    "pending"
  );
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const token = session?.access_token;
  const firmId = currentFirm?.id;
  const isAdmin =
    currentFirm?.role === "owner" || currentFirm?.role === "admin";

  const load = async () => {
    if (!token || !firmId) return;
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/tasks?firm_id=${firmId}&status=${status}`,
        {},
        token
      );
      setTasks(res.tasks || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token, firmId, status]);

  const approve = async (id: string) => {
    if (!token) return;
    setActionId(id);
    try {
      await apiFetch(
        `/api/tasks/${id}/approve`,
        { method: "POST", body: JSON.stringify({}) },
        token
      );
      load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionId(null);
    }
  };

  const reject = async (id: string) => {
    if (!token) return;
    const reason = prompt("Rejection reason (optional)") || undefined;
    setActionId(id);
    try {
      await apiFetch(
        `/api/tasks/${id}/reject`,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        },
        token
      );
      load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Action Items</h1>
        <p className="text-slate-400 text-sm mt-1">
          Review and publish extracted tasks to Trello
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-900 rounded-lg w-fit border border-slate-800">
        {(["pending", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              status === s
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Loading…</div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-slate-500 text-sm">
            No {status} tasks
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <Card key={t.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="font-medium text-sm leading-snug">
                      {t.task}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Owner: {t.owner || "Unassigned"}</span>
                      {t.due_date && <span>Due: {formatDate(t.due_date)}</span>}
                      <span
                        className={
                          t.type === "confirmed"
                            ? "text-brand-400"
                            : "text-amber-400"
                        }
                      >
                        {t.type}
                      </span>
                    </div>
                    {t.evidence && (
                      <p className="text-xs text-slate-500 italic mt-1 line-clamp-2">
                        “{t.evidence}”
                      </p>
                    )}
                    {t.trello_card_url && (
                      <a
                        href={t.trello_card_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-brand-400 hover:underline mt-1"
                      >
                        Open in Trello <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {status === "pending" && isAdmin && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => approve(t.id)}
                        loading={actionId === t.id}
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => reject(t.id)}
                        disabled={actionId === t.id}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <AuthProvider>
      <DashboardShell>
        <TasksContent />
      </DashboardShell>
    </AuthProvider>
  );
}
