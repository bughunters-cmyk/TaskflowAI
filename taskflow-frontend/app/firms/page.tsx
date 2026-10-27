"use client";

import { AuthProvider } from "@/lib/auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { FirmOnboarding } from "@/components/dashboard/firm-onboarding";

export default function FirmsPage() {
  return (
    <AuthProvider>
      <DashboardShell>
        <FirmOnboarding />
      </DashboardShell>
    </AuthProvider>
  );
}
