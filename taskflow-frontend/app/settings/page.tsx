"use client";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function SettingsContent() {
  const { session, currentFirm, refreshFirms } = useAuth();
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

  const token = session?.access_token;
  const firmId = currentFirm?.id;
  const isAdmin =
    currentFirm?.role === "owner" || currentFirm?.role === "admin";

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
      .catch(console.error);
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
      const c = await apiFetch(
        `/api/firms/${firmId}/trello-configs`,
        {},
        token
      );
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

  if (!currentFirm) return null;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">{currentFirm.name}</p>
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
              <Button
                size="sm"
                variant="ghost"
                onClick={regenerateCode}
                loading={loading}
              >
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
                <div className="text-sm font-medium">
                  {m.user_id.slice(0, 8)}…
                </div>
                <div className="text-xs text-slate-500 capitalize">
                  {m.role} · {m.status}
                </div>
              </div>
              {isAdmin && m.role !== "owner" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => kick(m.user_id)}
                >
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
              <p className="text-sm text-slate-500">
                No Trello boards connected yet
              </p>
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
                  onChange={(e) =>
                    setTrelloForm({ ...trelloForm, name: e.target.value })
                  }
                  required
                />
                <Input
                  label="Trello API Key"
                  value={trelloForm.api_key}
                  onChange={(e) =>
                    setTrelloForm({ ...trelloForm, api_key: e.target.value })
                  }
                  required
                />
                <Input
                  label="Trello Token"
                  value={trelloForm.token}
                  onChange={(e) =>
                    setTrelloForm({ ...trelloForm, token: e.target.value })
                  }
                  required
                />
                <Input
                  label="List ID"
                  value={trelloForm.list_id}
                  onChange={(e) =>
                    setTrelloForm({ ...trelloForm, list_id: e.target.value })
                  }
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
