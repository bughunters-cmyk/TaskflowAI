"use client";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { OverviewPage } from "@/components/dashboard/overview-page";
import { FirmOnboarding } from "@/components/dashboard/firm-onboarding";

function HomeContent() {
  const { firms, loading } = useAuth();

  if (loading) return null;

  // First-time user → onboarding
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
