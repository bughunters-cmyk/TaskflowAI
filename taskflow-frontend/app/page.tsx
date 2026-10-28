"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { OverviewPage } from "@/components/dashboard/overview-page";
import { FirmOnboarding } from "@/components/dashboard/firm-onboarding";

function HomeContent() {
  // NOTE: `user` must exist in your auth context. If yours calls it `session`,
  // rename it here (and in the checks below).
  const { user, firms, loading } = useAuth();
  const router = useRouter();

  // Not signed in → send to login instead of showing onboarding
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) return null;

  // Signed in but no firm yet → onboarding
  if (firms.length === 0) {
    return <FirmOnboarding />;
  }

  return (
    <DashboardShell>
      <OverviewPage />
    </DashboardShell>
  );
}

export default function HomePage() {
  return (
    <AuthProvider>
      <HomeContent />
    </AuthProvider>
  );
}
