'use client';

import React from 'react';
import { ConfirmedTask } from '@/types/meeting';
import { ShieldCheck, Clock, User, Quote, Copy, Check, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EvidenceModalProps {
  task: ConfirmedTask | null;
  onClose: () => void;
}

export function EvidenceModal({ task, onClose }: EvidenceModalProps) {
  const [copied, setCopied] = React.useState(false);

  if (!task) return null;

  const handleCopy = () => {
    if (task.source_quote) {
      navigator.clipboard.writeText(`"${task.source_quote}" — ${task.speaker || 'Meeting Transcript'} (${task.transcript_timestamp || 'N/A'})`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const confidencePercent = Math.round(task.confidence * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-app-border bg-app-surface text-app-primary shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border bg-app-elevated/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-app-accent/15 border border-app-accent/30 text-app-accent flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 id="evidence-dialog-title" className="text-sm font-semibold">
                Decision Provenance & Evidence
              </h3>
              <p className="text-[11px] text-app-secondary">
                Verified transcription context and speaker attribution
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-app-border text-app-secondary hover:text-app-primary bg-app-surface transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Target Task Summary */}
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-app-secondary">
              Committed Action Item
            </span>
            <h4 className="text-sm font-medium text-app-primary mt-1">
              {task.title}
            </h4>
            {task.description && (
              <p className="text-app-secondary text-xs mt-1 leading-relaxed">
                {task.description}
              </p>
            )}
          </div>

          {/* Transcript Quote Excerpt */}
          <div className="p-3.5 rounded-lg border border-app-border bg-app-elevated/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-app-secondary text-[11px] font-mono">
                <Quote className="w-3.5 h-3.5 text-app-accent" />
                <span>Source Transcript Excerpt</span>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-0.5 rounded border border-app-border bg-app-surface text-[10px] text-app-secondary hover:text-app-primary transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-app-accent" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy Excerpt'}
              </button>
            </div>

            <blockquote className="text-xs italic text-app-primary font-serif leading-relaxed pl-2 border-l-2 border-app-accent">
              &ldquo;{task.source_quote}&rdquo;
            </blockquote>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="p-2.5 rounded-lg border border-app-border bg-app-surface/50">
              <span className="text-[10px] text-app-secondary font-mono block">Speaker</span>
              <div className="flex items-center gap-1.5 mt-1 font-medium text-xs">
                <User className="w-3 h-3 text-app-secondary" />
                <span className="truncate">{task.speaker || 'Attendee'}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-app-border bg-app-surface/50">
              <span className="text-[10px] text-app-secondary font-mono block">Audio Timestamp</span>
              <div className="flex items-center gap-1.5 mt-1 font-medium text-xs font-mono">
                <Clock className="w-3 h-3 text-app-secondary" />
                <span>{task.transcript_timestamp || '00:00'}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-app-border bg-app-surface/50">
              <span className="text-[10px] text-app-secondary font-mono block">Extraction Confidence</span>
              <div className="flex items-center gap-1.5 mt-1 font-medium text-xs font-mono text-app-accent">
                <Sparkles className="w-3 h-3" />
                <span>{confidencePercent}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-app-border bg-app-elevated/40 flex items-center justify-between text-xs">
          <span className="text-[11px] text-app-secondary font-mono">
            Audit Log ID: {task.id}
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-app-border bg-app-surface text-app-primary hover:bg-app-elevated transition-colors text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
