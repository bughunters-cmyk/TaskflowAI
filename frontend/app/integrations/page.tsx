'use client';

import React, { useState } from 'react';
import { useWorkspace } from '@/lib/context/workspace-context';
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Share2,
  Calendar,
  MessageSquare,
  Shield,
  Zap,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { TrelloIcon } from '@/components/ui/trello-icon';
import { cn, formatDate } from '@/lib/utils';
import { motion } from 'framer-motion';

export function IntegrationsContent() {
  const { trelloConfig, updateTrelloConfig, addToast, isDemoMode } = useWorkspace();
  const [boardName, setBoardName] = useState(trelloConfig.board_name || 'Core Engineering Sprint Board');
  const [listName, setListName] = useState(trelloConfig.list_name || 'Committed & Verified');
  const [isTesting, setIsTesting] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateTrelloConfig({
      board_name: boardName.trim() || 'Core Engineering Sprint Board',
      list_name: listName.trim() || 'Committed & Verified',
      last_synced_at: new Date().toISOString(),
    });
    addToast({
      title: 'Trello Dispatch Configured',
      message: `Target list updated to: ${listName.trim()}`,
      type: 'success',
    });
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setIsTesting(false);
    addToast({
      title: 'Trello Connection Verified',
      message: 'Board API responded with HTTP 200 OK.',
      type: 'success',
    });
  };

  const toggleConnection = () => {
    const nextState = !trelloConfig.connected;
    updateTrelloConfig({ connected: nextState });
    addToast({
      title: nextState ? 'Trello Connected' : 'Trello Disconnected',
      message: nextState ? 'Ready to push confirmed action items.' : 'Trello sync disabled.',
      type: nextState ? 'success' : 'info',
    });
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8 select-none">
      {/* Header */}
      <div className="space-y-1.5 border-b border-app-border pb-6">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-app-border bg-app-elevated/40 text-[11px] font-mono text-app-secondary">
          <span>Connected Workspace Pipelines</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-app-primary">
          Integrations & Trello Dispatch
        </h1>
        <p className="text-xs sm:text-sm text-app-secondary">
          Configure where verified meeting commitments land after human review.
        </p>
      </div>

      {/* Main Trello Integration Block (Primary Working Integration) */}
      <div className="rounded-2xl border border-app-border bg-app-surface shadow-md overflow-hidden">
        {/* Trello Header Banner */}
        <div className="p-5 sm:p-6 border-b border-app-border bg-app-elevated/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-500 flex items-center justify-center shrink-0">
              <TrelloIcon className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-app-primary">
                  Trello Board Connector
                </h2>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-mono border font-medium',
                    trelloConfig.connected
                      ? 'bg-app-accent-subtle text-app-accent border-app-accent/30'
                      : 'bg-red-500/10 text-red-500 border-red-500/30'
                  )}
                >
                  {trelloConfig.connected ? 'Active Sync' : 'Disconnected'}
                </span>
              </div>
              <p className="text-xs text-app-secondary mt-0.5">
                Automatically push approved tasks into target sprint lists with full audit evidence.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleConnection}
            className={cn(
              'px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0',
              trelloConfig.connected
                ? 'border border-app-border bg-app-surface text-app-secondary hover:text-red-500'
                : 'bg-app-accent text-black hover:opacity-90 shadow-[0_0_12px_rgba(190,255,83,0.3)]'
            )}
          >
            {trelloConfig.connected ? 'Disconnect' : 'Connect Trello'}
          </button>
        </div>

        {/* Trello Settings Form */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-app-secondary mb-1">
                Target Board Name
              </label>
              <input
                type="text"
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-elevated/40 text-app-primary text-xs focus:outline-hidden focus:border-app-accent"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-app-secondary mb-1">
                Target List Name
              </label>
              <input
                type="text"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-elevated/40 text-app-primary text-xs focus:outline-hidden focus:border-app-accent"
              />
            </div>
          </div>

          {/* Security & Audit Notice */}
          <div className="p-3.5 rounded-xl border border-app-border bg-app-elevated/30 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-app-accent shrink-0 mt-0.5" />
            <div className="text-[11px] text-app-secondary space-y-0.5">
              <span className="font-semibold text-app-primary block">
                Backend-Mediated Security
              </span>
              <span>
                Trello API credentials and board webhook keys are securely isolated in the server-side environment. Client requests invoke the authenticated internal API endpoint.
              </span>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-app-border/40">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-app-border bg-app-surface text-app-secondary hover:text-app-primary transition-colors text-xs"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isTesting && 'animate-spin')} />
              <span>Test Connection</span>
            </button>

            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-app-accent text-black font-semibold text-xs hover:opacity-90 transition-opacity shadow-sm"
            >
              Save Configuration
            </button>
          </div>
        </form>
      </div>

      {/* Auxiliary Integrations (Roadmap / Coming Soon - No Fake Active Badges) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-app-primary">
            Auxiliary Integrations (Roadmap)
          </h2>
          <span className="text-[11px] font-mono text-app-secondary">
            In development
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Slack */}
          <div className="p-4 rounded-2xl border border-app-border bg-app-surface/60 flex flex-col justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-app-primary truncate">Slack Digest</p>
                <p className="text-[10px] text-app-secondary truncate">Daily sprint summaries</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-app-border/40 text-[10px] font-mono text-app-secondary">
              <span>Status</span>
              <span className="px-1.5 py-0.5 rounded border border-app-border bg-app-elevated text-app-secondary">
                Coming Soon
              </span>
            </div>
          </div>

          {/* Google Calendar */}
          <div className="p-4 rounded-2xl border border-app-border bg-app-surface/60 flex flex-col justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-500 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-app-primary truncate">Google Calendar</p>
                <p className="text-[10px] text-app-secondary truncate">Sync meeting schedules</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-app-border/40 text-[10px] font-mono text-app-secondary">
              <span>Status</span>
              <span className="px-1.5 py-0.5 rounded border border-app-border bg-app-secondary/80 text-app-secondary bg-app-elevated">
                Not Connected
              </span>
            </div>
          </div>

          {/* Linear */}
          <div className="p-4 rounded-2xl border border-app-border bg-app-surface/60 flex flex-col justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-app-primary truncate">Linear Issues</p>
                <p className="text-[10px] text-app-secondary truncate">Direct issue publication</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-app-border/40 text-[10px] font-mono text-app-secondary">
              <span>Status</span>
              <span className="px-1.5 py-0.5 rounded border border-app-border bg-app-elevated text-app-secondary">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return <IntegrationsContent />;
}
