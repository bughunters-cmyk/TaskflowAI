'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useWorkspace } from '@/lib/context/workspace-context';
import { ZiroLogo } from '@/components/layout/ziro-logo';
import { ThemeSwitcher } from '@/components/theme-switcher';
import {
  LayoutDashboard,
  Mic,
  Calendar,
  CheckSquare,
  Share2,
  Settings,
  Building2,
  Radio,
  Clock,
  Sparkles,
} from 'lucide-react';
import { TrelloIcon } from '@/components/ui/trello-icon';
import { cn, formatDate } from '@/lib/utils';
import { motion } from 'framer-motion';

interface SidebarProps {
  onMobileClose?: () => void;
}

export function Sidebar({ onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { meetings, currentMeetingId, selectMeeting, trelloConfig } = useWorkspace();
  const [workspaceName, setWorkspaceName] = useState('TaskFlow Workspace');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('taskflow_workspace_name');
      if (stored) {
        setWorkspaceName(stored);
      }
    }
  }, []);

  const navItems = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/recording', label: 'New Recording', icon: Mic, highlight: true },
    { href: '/meetings', label: 'Meetings', icon: Calendar },
    { href: '/action-items', label: 'Action Items', icon: CheckSquare },
    { href: '/integrations', label: 'Integrations', icon: Share2 },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  const handleRecentMeetingClick = (meetingId: string) => {
    selectMeeting(meetingId);
    if (onMobileClose) onMobileClose();
    router.push(`/meetings?id=${meetingId}`);
  };

  return (
    <aside className="w-64 h-full flex flex-col border-r border-app-border bg-app-sidebar text-app-primary select-none shrink-0 overflow-y-auto">
      {/* Workspace Brand & Header */}
      <div className="p-4 border-b border-app-border flex flex-col gap-3">
        <ZiroLogo showTagline={false} />

        {/* Workspace Display (Clean Display, No Misleading Dropdown) */}
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-app-border bg-app-surface/60 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-3.5 h-3.5 text-app-accent shrink-0" />
            <span className="font-medium text-app-primary truncate" title={workspaceName}>
              {workspaceName}
            </span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.2 rounded border border-app-border bg-app-elevated text-app-secondary shrink-0">
            Core
          </span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                'group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-app-elevated text-app-primary border border-app-border/80 shadow-xs font-semibold'
                  : 'text-app-secondary hover:text-app-primary hover:bg-app-elevated/40'
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={cn(
                    'w-4.5 h-4.5 transition-colors shrink-0',
                    isActive ? 'text-app-accent' : 'text-app-secondary group-hover:text-app-primary'
                  )}
                />
                <span className="truncate">{item.label}</span>
              </div>

              {item.highlight ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono bg-app-accent/15 text-app-accent border border-app-accent/30 font-semibold shrink-0">
                  <Radio className="w-3 h-3 animate-pulse" />
                  REC
                </span>
              ) : isActive ? (
                <span className="w-2 h-2 rounded-full bg-app-accent shadow-[0_0_8px_rgba(190,255,83,0.6)] shrink-0" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Recent Meetings Section */}
      <div className="flex-1 px-3 py-3 border-t border-app-border min-h-0 overflow-y-auto">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-xs font-medium tracking-wide text-app-secondary uppercase font-mono">
            Recent Meetings
          </span>
          <span className="text-xs font-mono text-app-secondary">
            {meetings.length}
          </span>
        </div>

        <div className="space-y-1">
          {meetings.slice(0, 6).map((m) => {
            const isSelected = m.id === currentMeetingId && pathname.startsWith('/meetings');
            return (
              <button
                key={m.id}
                onClick={() => handleRecentMeetingClick(m.id)}
                className={cn(
                  'w-full text-left p-2.5 rounded-xl text-xs sm:text-[13px] transition-all duration-150 flex flex-col gap-1',
                  isSelected
                    ? 'bg-app-elevated border border-app-border text-app-primary shadow-xs'
                    : 'text-app-secondary hover:text-app-primary hover:bg-app-elevated/40'
                )}
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="font-medium truncate leading-tight text-xs sm:text-[13px] flex-1 text-app-primary">
                    {m.title}
                  </span>
                  {m.confirmed_tasks.some((t) => t.trello_status === 'synced') && (
                    <span
                      className="w-2 h-2 rounded-full bg-app-accent shrink-0 shadow-[0_0_6px_rgba(190,255,83,0.5)]"
                      title="Published to Trello"
                    />
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-app-secondary font-mono">
                  <span className="flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3 text-app-secondary/80" />
                    {formatDate(m.date)}
                  </span>
                  <span>•</span>
                  <span className="truncate">{m.confirmed_tasks.length} tasks</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer System Status & User Profile */}
      <div className="p-3.5 border-t border-app-border bg-app-elevated/30 flex flex-col gap-3">
        {/* Trello Connection Status Indicator */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs sm:text-[13px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <TrelloIcon className="w-4 h-4 text-blue-500 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-medium text-xs sm:text-[13px] truncate text-app-primary">Trello Sprint</span>
              <span className="text-xs font-mono text-app-secondary">
                {trelloConfig.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          <span
            className={cn(
              'w-2.5 h-2.5 rounded-full shrink-0',
              trelloConfig.connected ? 'bg-app-accent shadow-[0_0_8px_rgba(190,255,83,0.6)]' : 'bg-red-500'
            )}
          />
        </div>

        {/* User Profile & Theme Switcher */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-app-accent/20 border border-app-accent/40 text-app-accent flex items-center justify-center text-xs font-semibold shrink-0">
              AS
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-app-primary truncate">Aditya S.</span>
              <span className="text-xs text-app-secondary truncate font-mono">Frontend Lead</span>
            </div>
          </div>

          <ThemeSwitcher />
        </div>
      </div>
    </aside>
  );
}
