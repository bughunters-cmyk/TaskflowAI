'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { CommandPalette } from '@/components/layout/command-palette';
import { ToastContainer } from '@/components/layout/toast-container';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-app-bg text-app-primary">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden lg:block h-full">
        <Sidebar />
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 lg:hidden flex bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-72 h-full bg-app-sidebar border-r border-app-border relative flex flex-col animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-3 right-3 z-10">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg border border-app-border text-app-secondary hover:text-app-primary bg-app-elevated/80"
                aria-label="Close navigation menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <Sidebar onMobileClose={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <Topbar onMobileMenuToggle={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto min-h-0 bg-app-bg">
          {children}
        </main>
      </div>

      {/* Global Utilities */}
      <CommandPalette />
      <ToastContainer />
    </div>
  );
}
