"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Building2, Users, ArrowRight } from "lucide-react";

export function FirmOnboarding() {
  const { session, refreshFirms, setCurrentFirm } = useAuth();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const token = session?.access_token;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const firm = await apiFetch(
        "/api/firms",
        {
          method: "POST",
          body: JSON.stringify({ name, slug: slug || undefined }),
        },
        token
      );
      await refreshFirms();
      setCurrentFirm({
        id: firm.id,
        name: firm.name,
        slug: firm.slug,
        role: "owner",
      });
    } catch (err: any) {
      setError(err.message || "Failed to create firm");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      await apiFetch(
        "/api/firms/join",
        {
          method: "POST",
          body: JSON.stringify({ slug }),
        },
        token
      );
      await refreshFirms();
    } catch (err: any) {
      setError(err.message || "Failed to join firm");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">Set up your workspace</h1>
          <p className="text-slate-400 text-sm">
            Create a new firm or join an existing one with an invite code
          </p>
        </div>

        {mode === "choose" && (
          <div className="grid gap-3">
            <button
              onClick={() => setMode("create")}
              className="flex items-start gap-4 p-5 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-brand-500/40 hover:bg-slate-900 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0 group-hover:bg-brand-500/20">
                <Building2 className="w-5 h-5 text-brand-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium mb-0.5">Create a firm</div>
                <p className="text-sm text-slate-400">
                  For team leads and admins. You&apos;ll be the owner and can
                  invite others later.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-brand-400 mt-1" />
            </button>

            <button
              onClick={() => setMode("join")}
              className="flex items-start gap-4 p-5 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-brand-500/40 hover:bg-slate-900 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-slate-700">
                <Users className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium mb-0.5">Join a firm</div>
                <p className="text-sm text-slate-400">
                  Have an invite code? Enter it to join your team&apos;s
                  workspace.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-brand-400 mt-1" />
            </button>
          </div>
        )}

        {mode === "create" && (
          <Card>
            <CardHeader>
              <h2 className="font-medium">Create a new firm</h2>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <Input
                  id="name"
                  label="Firm name"
                  placeholder="Acme Corp"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Input
                  id="slug"
                  label="Invite code (optional)"
                  placeholder="acme-corp"
                  value={slug}
                  onChange={(e) =>
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "-")
                    )
                  }
                />
                <p className="text-xs text-slate-500 -mt-2">
                  Others will use this code to join. Leave blank to auto-generate.
                </p>

                {error && (
                  <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setMode("choose")}
                  >
                    Back
                  </Button>
                  <Button type="submit" loading={loading} className="flex-1">
                    Create firm
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {mode === "join" && (
          <Card>
            <CardHeader>
              <h2 className="font-medium">Join with invite code</h2>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoin} className="space-y-4">
                <Input
                  id="slug"
                  label="Invite code"
                  placeholder="acme-corp"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  required
                />

                {error && (
                  <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setMode("choose")}
                  >
                    Back
                  </Button>
                  <Button type="submit" loading={loading} className="flex-1">
                    Join firm
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
