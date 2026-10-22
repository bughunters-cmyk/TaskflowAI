'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useWorkspace } from '@/lib/context/workspace-context';
import {
  Menu,
  Search,
  Database,
  Radio,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopbarProps {
  onMobileMenuToggle: () => void;
}

export function Topbar({ onMobileMenuToggle }: TopbarProps) {
  const pathname = usePathname();
  const { currentMeeting, isDemoMode, setDemoMode, setIsCommandPaletteOpen } = useWorkspace();

  const getBreadcrumbs = () => {
    if (pathname === '/') return ['Workspace', 'Overview'];
    if (pathname === '/recording') return ['Intelligence', 'Audio Capture'];
    if (pathname.startsWith('/meetings')) {
      return ['Intelligence', 'Meetings', currentMeeting?.title || 'Selected Meeting'];
    }
    if (pathname === '/action-items') return ['Execution', 'Action Items'];
    if (pathname === '/integrations') return ['Settings', 'Integrations'];
    if (pathname === '/settings') return ['Settings', 'Preferences'];
    return ['Workspace', 'Meeting'];
  };

  const crumbs = getBreadcrumbs();

  return (
    <header className="h-14 border-b border-app-border bg-app-surface/80 backdrop-blur-md px-4 flex items-center justify-between select-none sticky top-0 z-30">
      {/* Left: Mobile trigger & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-1.5 rounded-lg border border-app-border text-app-secondary hover:text-app-primary hover:bg-app-elevated transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
          {crumbs.map((crumb, idx) => {
            const isLast = idx === crumbs.length - 1;
            return (
              <React.Fragment key={crumb}>
                {idx > 0 && <ChevronRight className="w-3 h-3 text-app-secondary/60 shrink-0" />}
                <span
                  className={cn(
                    'truncate max-w-[140px] sm:max-w-[260px]',
                    isLast ? 'text-app-primary font-medium' : 'text-app-secondary hidden sm:inline'
                  )}
                >
                  {crumb}
                </span>
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right: Quick actions, Command Palette button, Demo Mode Badge */}
      <div className="flex items-center gap-2.5">
        {/* Command Palette Trigger */}
        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-app-border bg-app-elevated/40 text-app-secondary hover:text-app-primary hover:bg-app-elevated transition-colors text-xs"
          title="Open Command Palette (⌘K / Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden md:inline font-normal">Command Menu</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono rounded border border-app-border bg-app-surface text-app-secondary">
            ⌘K
          </kbd>
        </button>

        {/* Backend Connection / Demo Mode Pill */}
        <button
          onClick={() => setDemoMode(!isDemoMode)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all duration-150',
            isDemoMode
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20'
              : 'bg-app-accent-subtle border-app-accent/30 text-app-accent hover:bg-app-accent/20'
          )}
          title="Click to toggle between Demo Mode and Live API Mode"
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full shrink-0',
              isDemoMode ? 'bg-amber-500' : 'bg-app-accent animate-pulse'
            )}
          />
          <span className="hidden xs:inline">
            {isDemoMode ? 'Demo Mode' : 'Live API'}
          </span>
        </button>
      </div>
    </header>
  );
}
