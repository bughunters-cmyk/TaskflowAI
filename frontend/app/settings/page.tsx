'use client';

import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/lib/context/workspace-context';
import { useTheme } from 'next-themes';
import {
  Server,
  Database,
  Volume2,
  RotateCcw,
  AlertTriangle,
  Sun,
  Moon,
  Laptop,
  Sparkles,
  Sliders,
  Bell,
  Eye,
  Check,
  Building2,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export function SettingsContent() {
  const { isDemoMode, setDemoMode, resetToDemoData, addToast } = useWorkspace();
  const { theme, setTheme } = useTheme();

  // Local preferences state
  const [mounted, setMounted] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [audioQuality, setAudioQuality] = useState('16khz_mono');
  const [workspaceName, setWorkspaceName] = useState('TaskFlow Workspace');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [compactSidebar, setCompactSidebar] = useState(false);
  const [notifyTrelloSync, setNotifyTrelloSync] = useState(true);
  const [notifyDuplicates, setNotifyDuplicates] = useState(true);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const storedUrl = localStorage.getItem('ziro_api_base_url') || '';
      setApiBaseUrl(storedUrl);

      const storedWs = localStorage.getItem('taskflow_workspace_name') || 'TaskFlow Workspace';
      setWorkspaceName(storedWs);

      const storedMotion = localStorage.getItem('taskflow_reduced_motion') === 'true';
      setReducedMotion(storedMotion);

      const storedSidebar = localStorage.getItem('taskflow_compact_sidebar') === 'true';
      setCompactSidebar(storedSidebar);

      const storedNotifyTrello = localStorage.getItem('taskflow_notify_trello_sync');
      if (storedNotifyTrello !== null) setNotifyTrelloSync(storedNotifyTrello === 'true');

      const storedNotifyDup = localStorage.getItem('taskflow_notify_duplicates');
      if (storedNotifyDup !== null) setNotifyDuplicates(storedNotifyDup === 'true');
    }
  }, []);

  const handleSaveWorkspaceName = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      const cleanName = workspaceName.trim() || 'TaskFlow Workspace';
      localStorage.setItem('taskflow_workspace_name', cleanName);
      setWorkspaceName(cleanName);
      addToast({
        title: 'Workspace Name Updated',
        message: `Display name set to "${cleanName}".`,
        type: 'success',
      });
    }
  };

  const handleToggleReducedMotion = () => {
    const nextVal = !reducedMotion;
    setReducedMotion(nextVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('taskflow_reduced_motion', String(nextVal));
      if (nextVal) {
        document.documentElement.classList.add('reduced-motion');
      } else {
        document.documentElement.classList.remove('reduced-motion');
      }
    }
    addToast({
      title: 'Reduced Motion Preference',
      message: nextVal ? 'Micro-interactions minimized.' : 'Standard animations enabled.',
      type: 'info',
    });
  };

  const handleToggleCompactSidebar = () => {
    const nextVal = !compactSidebar;
    setCompactSidebar(nextVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('taskflow_compact_sidebar', String(nextVal));
    }
    addToast({
      title: 'Sidebar Layout',
      message: nextVal ? 'Compact sidebar mode active.' : 'Expanded sidebar mode active.',
      type: 'info',
    });
  };

  const handleToggleNotifyTrello = () => {
    const nextVal = !notifyTrelloSync;
    setNotifyTrelloSync(nextVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('taskflow_notify_trello_sync', String(nextVal));
    }
  };

  const handleToggleNotifyDuplicates = () => {
    const nextVal = !notifyDuplicates;
    setNotifyDuplicates(nextVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('taskflow_notify_duplicates', String(nextVal));
    }
  };

  const handleResetLocalPreferences = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('taskflow_workspace_name');
      localStorage.removeItem('taskflow_reduced_motion');
      localStorage.removeItem('taskflow_compact_sidebar');
      localStorage.removeItem('taskflow_notify_trello_sync');
      localStorage.removeItem('taskflow_notify_duplicates');
      setWorkspaceName('TaskFlow Workspace');
      setReducedMotion(false);
      setCompactSidebar(false);
      setNotifyTrelloSync(true);
      setNotifyDuplicates(true);
      setTheme('dark');
      document.documentElement.classList.remove('reduced-motion');
      addToast({
        title: 'Preferences Restored',
        message: 'All local frontend settings reset to factory defaults.',
        type: 'info',
      });
    }
  };

  const handleSaveApiSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      localStorage.setItem('ziro_api_base_url', apiBaseUrl.trim());
      addToast({
        title: 'API Configuration Saved',
        message: apiBaseUrl ? `Configured base URL: ${apiBaseUrl}` : 'Using default Next.js internal endpoints.',
        type: 'success',
      });
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8 select-none">
      {/* Header */}
      <div className="space-y-1.5 border-b border-app-border pb-6">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-app-border bg-app-elevated/40 text-[11px] font-mono text-app-secondary">
          <span>Client-Side Workspace Preferences</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-app-primary">
          Settings & Environment
        </h1>
        <p className="text-xs sm:text-sm text-app-secondary">
          Configure appearance, animation accessibility, local workspace preferences, and execution runtime.
        </p>
      </div>

      {/* 1. Appearance & Theme Selection */}
      <div className="p-5 sm:p-6 rounded-2xl border border-app-border bg-app-surface shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-app-elevated border border-app-border flex items-center justify-center text-app-primary">
              <Sun className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-app-primary">
                Theme & Interface Appearance
              </h2>
              <p className="text-xs text-app-secondary">
                Select between dark graphite, clean light mode, or follow system OS preferences.
              </p>
            </div>
          </div>
        </div>

        {mounted && (
          <div className="grid grid-cols-3 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={cn(
                'p-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 text-xs transition-all',
                theme === 'dark'
                  ? 'border-app-accent bg-app-accent-subtle/20 text-app-accent font-semibold shadow-xs'
                  : 'border-app-border bg-app-elevated/30 text-app-secondary hover:text-app-primary'
              )}
            >
              <Moon className="w-4 h-4" />
              <span>Dark Graphite</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('light')}
              className={cn(
                'p-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 text-xs transition-all',
                theme === 'light'
                  ? 'border-app-accent bg-app-accent-subtle/20 text-app-accent font-semibold shadow-xs'
                  : 'border-app-border bg-app-elevated/30 text-app-secondary hover:text-app-primary'
              )}
            >
              <Sun className="w-4 h-4" />
              <span>Light Mode</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('system')}
              className={cn(
                'p-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 text-xs transition-all',
                theme === 'system'
                  ? 'border-app-accent bg-app-accent-subtle/20 text-app-accent font-semibold shadow-xs'
                  : 'border-app-border bg-app-elevated/30 text-app-secondary hover:text-app-primary'
              )}
            >
              <Laptop className="w-4 h-4" />
              <span>System Sync</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Workspace Customization */}
      <div className="p-5 sm:p-6 rounded-2xl border border-app-border bg-app-surface shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-app-elevated border border-app-border flex items-center justify-center text-app-primary">
            <Building2 className="w-5 h-5 text-app-accent" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-app-primary">
              Workspace Display Name
            </h2>
            <p className="text-xs text-app-secondary">
              Personalize the workspace label rendered across your sidebar navigation.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveWorkspaceName} className="flex gap-2">
          <input
            type="text"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="e.g. Acme Engineering or TaskFlow Workspace"
            className="flex-1 px-3 py-2 rounded-xl border border-app-border bg-app-elevated/40 text-app-primary text-xs outline-hidden focus:border-app-accent"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-app-accent text-black font-semibold text-xs hover:opacity-95 transition-opacity"
          >
            Save Name
          </button>
        </form>
      </div>

      {/* 3. Accessibility & Motion Preferences */}
      <div className="p-5 sm:p-6 rounded-2xl border border-app-border bg-app-surface shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-app-elevated border border-app-border flex items-center justify-center text-app-primary">
            <Sliders className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-app-primary">
              Accessibility & Animation Controls
            </h2>
            <p className="text-xs text-app-secondary">
              Configure micro-interactions, motion sensitivity, and navigation layouts.
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          {/* Reduced Motion Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-app-border bg-app-elevated/20 text-xs">
            <div className="space-y-0.5">
              <span className="font-semibold text-app-primary block">Reduced Motion</span>
              <span className="text-app-secondary text-[11px]">
                Minimize Framer Motion transitions and decorative spring physics.
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleReducedMotion}
              className={cn(
                'w-11 h-6 rounded-full transition-colors relative p-0.5',
                reducedMotion ? 'bg-app-accent' : 'bg-app-elevated border border-app-border'
              )}
              aria-label="Toggle reduced motion"
            >
              <div
                className={cn(
                  'w-5 h-5 rounded-full bg-black transition-transform duration-200',
                  reducedMotion ? 'translate-x-5 bg-black' : 'translate-x-0 bg-app-secondary'
                )}
              />
            </button>
          </div>

          {/* Compact Sidebar Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-app-border bg-app-elevated/20 text-xs">
            <div className="space-y-0.5">
              <span className="font-semibold text-app-primary block">Compact Navigation Layout</span>
              <span className="text-app-secondary text-[11px]">
                Condense sidebar spacing for higher density on smaller laptop displays.
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleCompactSidebar}
              className={cn(
                'w-11 h-6 rounded-full transition-colors relative p-0.5',
                compactSidebar ? 'bg-app-accent' : 'bg-app-elevated border border-app-border'
              )}
              aria-label="Toggle compact sidebar"
            >
              <div
                className={cn(
                  'w-5 h-5 rounded-full bg-black transition-transform duration-200',
                  compactSidebar ? 'translate-x-5 bg-black' : 'translate-x-0 bg-app-secondary'
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 4. In-App Notifications Preferences */}
      <div className="p-5 sm:p-6 rounded-2xl border border-app-border bg-app-surface shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-app-elevated border border-app-border flex items-center justify-center text-app-primary">
            <Bell className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-app-primary">
              In-App Notification Messages
            </h2>
            <p className="text-xs text-app-secondary">
              Toggle toast messages for Trello publish confirmations and audio upload status.
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between p-3 rounded-xl border border-app-border bg-app-elevated/20 text-xs">
            <div className="space-y-0.5">
              <span className="font-semibold text-app-primary block">Trello Sync Confirmations</span>
              <span className="text-app-secondary text-[11px]">
                Show toast message whenever a confirmed card is dispatched to Trello.
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleNotifyTrello}
              className={cn(
                'w-11 h-6 rounded-full transition-colors relative p-0.5',
                notifyTrelloSync ? 'bg-app-accent' : 'bg-app-elevated border border-app-border'
              )}
            >
              <div
                className={cn(
                  'w-5 h-5 rounded-full bg-black transition-transform duration-200',
                  notifyTrelloSync ? 'translate-x-5 bg-black' : 'translate-x-0 bg-app-secondary'
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-app-border bg-app-elevated/20 text-xs">
            <div className="space-y-0.5">
              <span className="font-semibold text-app-primary block">Duplicate Audio Detection Notices</span>
              <span className="text-app-secondary text-[11px]">
                Alert when a previously analyzed audio file hash is uploaded again.
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleNotifyDuplicates}
              className={cn(
                'w-11 h-6 rounded-full transition-colors relative p-0.5',
                notifyDuplicates ? 'bg-app-accent' : 'bg-app-elevated border border-app-border'
              )}
            >
              <div
                className={cn(
                  'w-5 h-5 rounded-full bg-black transition-transform duration-200',
                  notifyDuplicates ? 'translate-x-5 bg-black' : 'translate-x-0 bg-app-secondary'
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Demo Mode / Live Mode Switcher Block */}
      <div className="p-5 sm:p-6 rounded-2xl border border-app-border bg-app-surface shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-app-elevated border border-app-border flex items-center justify-center text-app-primary">
              <Database className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-app-primary">
                Execution Mode
              </h2>
              <p className="text-xs text-app-secondary">
                Switch between guaranteed local hackathon simulation and live FastAPI backend.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1 rounded-xl border border-app-border bg-app-elevated/60">
            <button
              type="button"
              onClick={() => setDemoMode(true)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                isDemoMode
                  ? 'bg-amber-500 text-black font-semibold shadow-xs'
                  : 'text-app-secondary hover:text-app-primary'
              )}
            >
              Demo Mode
            </button>
            <button
              type="button"
              onClick={() => setDemoMode(false)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                !isDemoMode
                  ? 'bg-app-accent text-black font-semibold shadow-xs'
                  : 'text-app-secondary hover:text-app-primary'
              )}
            >
              Live API Mode
            </button>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-app-border bg-app-elevated/30 text-xs text-app-secondary">
          {isDemoMode ? (
            <p>
              <strong className="text-amber-500 font-mono">Demo Mode Active:</strong> All meeting analyses, clarification resolutions, and Trello push approvals are simulated locally with realistic delays and guaranteed hackathon reliability.
            </p>
          ) : (
            <p>
              <strong className="text-app-accent font-mono">Live API Mode Active:</strong> Requests will hit the configured backend endpoint or internal App Router endpoints (<code className="font-mono text-app-primary">/api/analyze</code>, <code className="font-mono text-app-primary">/api/tasks/:id/approve</code>).
            </p>
          )}
        </div>
      </div>

      {/* 6. Backend API Configuration */}
      <form onSubmit={handleSaveApiSettings} className="p-5 sm:p-6 rounded-2xl border border-app-border bg-app-surface shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-app-elevated border border-app-border flex items-center justify-center text-app-primary">
            <Server className="w-5 h-5 text-app-accent" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-app-primary">
              Backend API Endpoint Override
            </h2>
            <p className="text-xs text-app-secondary">
              Override <code className="font-mono text-[11px]">NEXT_PUBLIC_API_BASE_URL</code> for external servers.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-app-secondary">
            API Base URL (Leave empty for default Next.js route handlers)
          </label>
          <input
            type="text"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="e.g. https://api.taskflow-workspace.io or empty"
            className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-elevated/40 text-app-primary text-xs font-mono focus:outline-hidden focus:border-app-accent"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] font-mono text-app-secondary">
            Current: {apiBaseUrl || '(Internal Next.js App Router API)'}
          </span>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-app-accent text-black font-semibold text-xs hover:opacity-90 transition-opacity"
          >
            Save Base URL
          </button>
        </div>
      </form>

      {/* 7. Reset Local Preferences & Reset Demo Data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Reset Frontend Preferences */}
        <div className="p-5 rounded-2xl border border-app-border bg-app-surface shadow-xs flex flex-col justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xs font-semibold text-app-primary flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-app-secondary" />
              Reset Local Preferences
            </h2>
            <p className="text-[11px] text-app-secondary">
              Reset appearance, motion, sidebar layout, and notification settings to factory defaults.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetLocalPreferences}
            className="px-3.5 py-2 rounded-xl border border-app-border bg-app-elevated text-xs font-medium text-app-primary hover:bg-app-elevated/80 transition-colors self-start"
          >
            Reset Preferences
          </button>
        </div>

        {/* Reset Workspace Demo Data */}
        <div className="p-5 rounded-2xl border border-red-500/30 bg-red-500/5 shadow-xs flex flex-col justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xs font-semibold text-red-500 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Reset Workspace Data
            </h2>
            <p className="text-[11px] text-app-secondary">
              Restore sample meetings, confirmed tasks, and clarifications to demo baseline.
            </p>
          </div>
          <button
            type="button"
            onClick={resetToDemoData}
            className="px-3.5 py-2 rounded-xl border border-red-500/40 bg-app-surface text-red-500 hover:bg-red-500/10 text-xs font-semibold transition-colors self-start"
          >
            Reset Demo Data
          </button>
        </div>
      </div>

      {/* Storage Scope Disclaimer */}
      <div className="pt-2 text-center text-[11px] font-mono text-app-secondary/70 flex items-center justify-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-app-accent" />
        <span>Preferences stored locally in your browser's localStorage • No remote account sync</span>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return <SettingsContent />;
}
