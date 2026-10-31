"use client";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";

function SettingsContent() {
  const { session, currentFirm, firms, setCurrentFirm, refreshFirms } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [showTrelloForm, setShowTrelloForm] = useState(false);
  const [trelloForm, setTrelloForm] = useState({
    name: "Default Board",
    api_key: "",
    token: "",
    list_id: "",
    is_default: true,
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // delete firm state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const token = session?.access_token;
  const firmId = currentFirm?.id;
  const isAdmin =
    currentFirm?.role === "owner" || currentFirm?.role === "admin";
  const isOwner = currentFirm?.role === "owner";

  useEffect(() => {
    if (!token || !firmId) return;
    Promise.all([
      apiFetch(`/api/firms/${firmId}/members`, {}, token),
      apiFetch(`/api/firms/${firmId}/trello-configs`, {}, token),
    ])
      .then(([m, c]) => {
        setMembers(m.members || []);
        setConfigs(c.configs || []);
      })
      .catch((e) => console.error("Settings load error:", e));
  }, [token, firmId]);

  const addTrello = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !firmId) return;
    setLoading(true);
    setMsg("");
    try {
      await apiFetch(
        "/api/trello-configs",
        {
          method: "POST",
          body: JSON.stringify({ ...trelloForm, firm_id: firmId }),
        },
        token
      );
      setMsg("Trello board connected");
      setShowTrelloForm(false);
      const c = await apiFetch(`/api/firms/${firmId}/trello-configs`, {}, token);
      setConfigs(c.configs || []);
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const regenerateCode = async () => {
    if (!token || !firmId) return;
    if (!confirm("Generate a new invite code? The old one will stop working.")) return;
    setLoading(true);
    setMsg("");
    try {
      await apiFetch(
        `/api/firms/${firmId}/invite-code/regenerate`,
        { method: "POST" },
        token
      );
      await refreshFirms();
      setMsg("New invite code generated");
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const kick = async (userId: string) => {
    if (!token || !firmId || !confirm("Remove this member?")) return;
    try {
      await apiFetch(
        `/api/firms/${firmId}/members/${userId}`,
        { method: "DELETE" },
        token
      );
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteFirm = async () => {
    if (!token || !currentFirm || confirmText.trim() !== currentFirm.name) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await apiFetch(`/api/firms/${currentFirm.id}`, { method: "DELETE" }, token);
      await refreshFirms();
      const remaining = firms.filter((f) => f.id !== currentFirm.id);
      if (remaining.length > 0) {
        setCurrentFirm(remaining[0]);
      } else {
        setCurrentFirm(null);
      }
      router.push("/");
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete firm");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!currentFirm) return null;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">
          {currentFirm.name}
          <span className="ml-2 text-xs text-slate-500 capitalize">
            · your role: {currentFirm.role}
          </span>
        </p>
      </div>

      {/* Invite code */}
      <Card>
        <CardHeader>
          <h2 className="font-medium text-sm">Invite code</h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <code className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono text-brand-400">
              {currentFirm.invite_code ?? "—"}
            </code>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (!currentFirm.invite_code) return;
                navigator.clipboard.writeText(currentFirm.invite_code);
                setMsg("Copied!");
              }}
            >
              Copy
            </Button>
            {isAdmin && (
              <Button size="sm" variant="ghost" onClick={regenerateCode} loading={loading}>
                New code
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Share this code so teammates can join your firm
          </p>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <h2 className="font-medium text-sm">Members</h2>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0"
            >
              <div>
                <div className="text-sm font-medium">{m.user_id.slice(0, 8)}…</div>
                <div className="text-xs text-slate-500 capitalize">
                  {m.role} · {m.status}
                </div>
              </div>
              {isAdmin && m.role !== "owner" && (
                <Button size="sm" variant="ghost" onClick={() => kick(m.user_id)}>
                  Remove
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Trello */}
      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h2 className="font-medium text-sm">Trello boards</h2>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowTrelloForm(!showTrelloForm)}
            >
              {showTrelloForm ? "Cancel" : "Add board"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {configs.length === 0 && !showTrelloForm && (
              <p className="text-sm text-slate-500">No Trello boards connected yet</p>
            )}
            {configs.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0"
              >
                <div>
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-slate-500">
                    List: {c.list_id.slice(0, 12)}…
                    {c.is_default && " · Default"}
                  </div>
                </div>
              </div>
            ))}

            {showTrelloForm && (
              <form onSubmit={addTrello} className="space-y-3 pt-2">
                <Input
                  label="Board name"
                  value={trelloForm.name}
                  onChange={(e) => setTrelloForm({ ...trelloForm, name: e.target.value })}
                  required
                />
                <Input
                  label="Trello API Key"
                  value={trelloForm.api_key}
                  onChange={(e) => setTrelloForm({ ...trelloForm, api_key: e.target.value })}
                  required
                />
                <Input
                  label="Trello Token"
                  value={trelloForm.token}
                  onChange={(e) => setTrelloForm({ ...trelloForm, token: e.target.value })}
                  required
                />
                <Input
                  label="List ID"
                  value={trelloForm.list_id}
                  onChange={(e) => setTrelloForm({ ...trelloForm, list_id: e.target.value })}
                  required
                />
                <Button type="submit" loading={loading}>
                  Connect board
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {msg && (
        <div className="text-sm text-brand-400 bg-brand-500/10 border border-brand-500/20 rounded-lg px-4 py-2">
          {msg}
        </div>
      )}

      {/* Danger zone — owner only */}
      {isOwner && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/[0.04]">
          <div className="border-b border-red-500/10 px-4 py-3">
            <h2 className="text-[13px] font-medium text-red-400">Danger zone</h2>
          </div>
          <div className="px-4 py-4 space-y-3">
            <p className="text-[13px] text-slate-400 leading-relaxed">
              Deleting <span className="font-medium text-slate-200">{currentFirm.name}</span>{" "}
              permanently removes all meetings, tasks, members, and Trello connections.
              This cannot be undone.
            </p>

            {!deleteOpen ? (
              <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                Delete this firm
              </Button>
            ) : (
              <div className="space-y-3 rounded-md border border-red-500/20 bg-slate-950 p-3">
                <div className="flex items-start gap-2 text-[12px] text-amber-400/90">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Type <strong className="text-slate-200">{currentFirm.name}</strong> to confirm.
                  </span>
                </div>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={currentFirm.name}
                  className="w-full h-9 rounded-md border border-slate-700 bg-transparent px-3 text-[13px] text-slate-100 placeholder:text-slate-600 focus:border-red-500/40 focus:outline-none"
                  autoComplete="off"
                />
                {deleteError && (
                  <p className="text-[12px] text-red-400">{deleteError}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDeleteOpen(false);
                      setConfirmText("");
                      setDeleteError("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={confirmText.trim() !== currentFirm.name}
                    loading={deleteLoading}
                    onClick={handleDeleteFirm}
                  >
                    Permanently delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!isOwner && (
        <p className="text-xs text-slate-500">
          Only the firm owner can delete this firm. Your role: {currentFirm.role}
        </p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthProvider>
      <DashboardShell>
        <SettingsContent />
      </DashboardShell>
    </AuthProvider>
  );
}
