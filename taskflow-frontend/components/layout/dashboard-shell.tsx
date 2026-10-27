"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "./sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading, firms, currentFirm } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // No firm yet → redirect to firm onboarding
  if (firms.length === 0) {
    return (
      <div className="min-h-screen bg-surface-950">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950">
      <Sidebar />
      <main className="pl-60 min-h-screen">
        <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
