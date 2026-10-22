'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/lib/context/workspace-context';
import { useTheme } from 'next-themes';
import {
  Mic,
  LayoutDashboard,
  Calendar,
  CheckSquare,
  HelpCircle,
  Settings,
  Share2,
  Moon,
  Sun,
  Search,
  Database,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'Actions' | 'Navigation' | 'Meetings' | 'Preferences';
  action: () => void;
  shortcut?: string;
}

export function CommandPalette() {
  const router = useRouter();
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    meetings,
    selectMeeting,
    isDemoMode,
    setDemoMode,
  } = useWorkspace();
  const { theme, setTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(!isCommandPaletteOpen);
      } else if (e.key === 'Escape' && isCommandPaletteOpen) {
        setIsCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setIsCommandPaletteOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  const commands: CommandItem[] = [
    {
      id: 'cmd-record',
      title: 'New Audio Recording',
      subtitle: 'Open the audio capture workspace',
      icon: Mic,
      category: 'Actions',
      shortcut: 'R',
      action: () => {
        router.push('/recording');
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: 'cmd-overview',
      title: 'Overview Dashboard',
      subtitle: 'High-level meeting intelligence statistics',
      icon: LayoutDashboard,
      category: 'Navigation',
      action: () => {
        router.push('/');
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: 'cmd-meetings',
      title: 'All Meetings',
      subtitle: 'Browse all processed meeting transcripts',
      icon: Calendar,
      category: 'Navigation',
      action: () => {
        router.push('/meetings');
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: 'cmd-action-items',
      title: 'Action Items & Commitments',
      subtitle: 'Review confirmed tasks across all meetings',
      icon: CheckSquare,
      category: 'Navigation',
      action: () => {
        router.push('/action-items');
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: 'cmd-integrations',
      title: 'Integrations & Trello',
      subtitle: 'Manage board mappings and webhook sync',
      icon: Share2,
      category: 'Navigation',
      action: () => {
        router.push('/integrations');
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: 'cmd-settings',
      title: 'Workspace Settings',
      subtitle: 'Configure audio quality and API base URL',
      icon: Settings,
      category: 'Navigation',
      action: () => {
        router.push('/settings');
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: 'cmd-toggle-demo',
      title: isDemoMode ? 'Switch to Live API Mode' : 'Switch to Demo Mode',
      subtitle: isDemoMode ? 'Disable local mock simulation' : 'Enable resilient local mock mode',
      icon: Database,
      category: 'Preferences',
      action: () => {
        setDemoMode(!isDemoMode);
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: 'cmd-toggle-theme',
      title: theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme',
      subtitle: 'Toggle between editorial light and dark palette',
      icon: theme === 'dark' ? Sun : Moon,
      category: 'Preferences',
      action: () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
        setIsCommandPaletteOpen(false);
      },
    },
    // Dynamically inject recent meetings
    ...meetings.map((m) => ({
      id: `meeting-${m.id}`,
      title: m.title,
      subtitle: `${m.confirmed_tasks.length} confirmed • ${m.clarifications_needed.length} clarifications`,
      icon: Sparkles,
      category: 'Meetings' as const,
      action: () => {
        selectMeeting(m.id);
        router.push(`/meetings?id=${m.id}`);
        setIsCommandPaletteOpen(false);
      },
    })),
  ];

  const filtered = commands.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.subtitle && c.subtitle.toLowerCase().includes(search.toLowerCase())) ||
      c.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    }
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 sm:pt-28 px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => setIsCommandPaletteOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-app-border bg-app-surface text-app-primary shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-3.5 border-b border-app-border bg-app-elevated/40">
          <Search className="w-4 h-4 text-app-secondary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, meetings, actions... (↑↓ to select)"
            className="w-full h-12 bg-transparent px-3 text-sm text-app-primary placeholder:text-app-secondary outline-hidden"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded border border-app-border text-app-secondary bg-app-elevated">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-app-border/30">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-app-secondary">
              No matching commands or meetings found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={item.action}
                  className={cn(
                    'flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-xs',
                    isSelected
                      ? 'bg-app-elevated text-app-primary font-medium'
                      : 'text-app-secondary hover:text-app-primary hover:bg-app-elevated/50'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        'w-7 h-7 rounded-md flex items-center justify-center shrink-0 border border-app-border',
                        isSelected ? 'bg-app-surface text-app-accent' : 'bg-app-elevated'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 truncate">
                      <p className="text-xs truncate text-app-primary">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-[11px] truncate text-app-secondary mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[10px] text-app-secondary uppercase tracking-wider font-mono">
                      {item.category}
                    </span>
                    {isSelected && <ArrowRight className="w-3.5 h-3.5 text-app-accent" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Command Footer */}
        <div className="px-3.5 py-2 border-t border-app-border bg-app-elevated/40 flex items-center justify-between text-[11px] text-app-secondary">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-app-surface px-1 py-0.5 rounded border border-app-border">↵</kbd> Select
            </span>
            <span>
              <kbd className="font-mono bg-app-surface px-1 py-0.5 rounded border border-app-border">↑↓</kbd> Navigate
            </span>
          </div>
          <span className="font-mono text-[10px]">TaskFlow AI Intelligence Command</span>
        </div>
      </div>
    </div>
  );
}
