'use client';

import React from 'react';
import { ZiroLogo } from '@/components/layout/ziro-logo';
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Cpu,
  FileAudio,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProcessingStep {
  id: string;
  label: string;
  detail: string;
}

export const PROCESSING_STEPS: ProcessingStep[] = [
  {
    id: 'audio_received',
    label: 'Audio Payload Received',
    detail: 'Verified 16-bit linear PCM WAV container with RIFF chunk headers.',
  },
  {
    id: 'duplicate_verification',
    label: 'SHA-256 Duplicate Verification',
    detail: 'Generating acoustic fingerprint to prevent duplicate transcript processing.',
  },
  {
    id: 'stt_processing',
    label: 'Speech-to-Text Transcription',
    detail: 'Decoding speech dynamics into continuous multi-speaker transcript segments.',
  },
  {
    id: 'ai_extraction',
    label: 'AI Commitment & Task Extraction',
    detail: 'Analyzing speaker commitments, isolating ambiguity, and separating speculative ideas.',
  },
  {
    id: 'review_ready',
    label: 'Intelligence Review Ready',
    detail: 'Synthesizing three-column accountability board and Trello sync contracts.',
  },
];

interface AiProcessingDeckProps {
  currentStage: number; // 0 to 4
  status: 'processing' | 'error' | 'success';
  errorMessage?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
  audioFilename?: string;
  fileSizeKb?: number;
}

export function AiProcessingDeck({
  currentStage,
  status,
  errorMessage,
  onRetry,
  onCancel,
  audioFilename,
  fileSizeKb,
}: AiProcessingDeckProps) {
  return (
    <div className="w-full max-w-2xl mx-auto p-6 sm:p-10 rounded-2xl border border-app-border bg-app-surface shadow-2xl flex flex-col items-center gap-8 relative overflow-hidden select-none">
      {/* Background ambient accent glows */}
      <div className="absolute -top-32 -left-32 w-72 h-72 rounded-full bg-app-accent/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-72 h-72 rounded-full bg-app-accent/5 blur-3xl pointer-events-none" />

      {/* Centerpiece: Subtle rotating circular signal visualization surrounding ZIRO symbol */}
      <div className="relative w-44 h-44 flex items-center justify-center">
        {/* Outer orbital ring */}
        <div className="absolute inset-0 rounded-full border border-app-border border-dashed animate-orbit-spin opacity-40" />

        {/* Mid signal ring with accent notch */}
        <div className="absolute inset-3 rounded-full border border-app-accent/30 animate-orbit-reverse">
          <div className="w-2.5 h-2.5 rounded-full bg-app-accent absolute -top-1 left-1/2 -translate-x-1/2 shadow-xs" />
        </div>

        {/* Inner subtle radar sweep */}
        <div className="absolute inset-7 rounded-full border border-app-border/80 bg-app-elevated/40 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-app-accent/10 to-transparent animate-radar-sweep" />
        </div>

        {/* Center TaskFlow AI Geometric Symbol */}
        <div className="relative z-10 w-16 h-16 rounded-2xl border border-app-accent/40 bg-app-surface flex items-center justify-center shadow-lg">
          <span className="font-mono text-base font-bold tracking-tighter text-app-accent">
            TF•AI
          </span>
        </div>
      </div>

      {/* Headline & Concise Explanation */}
      <div className="text-center space-y-2 max-w-md">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-app-accent/30 bg-app-accent-subtle text-[11px] font-mono text-app-accent">
          <Radio className="w-3 h-3 animate-pulse" />
          <span>TaskFlow AI Autonomous Intelligence Engine</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-app-primary tracking-tight">
          {status === 'error'
            ? 'Processing Encountered an Issue'
            : status === 'success'
            ? 'Intelligence Extraction Complete'
            : 'Extracting Actionable Commitments'}
        </h2>

        <p className="text-xs text-app-secondary leading-relaxed">
          {status === 'error'
            ? 'The backend service reported an error during transcription or LLM candidate extraction.'
            : status === 'success'
            ? 'Verified decisions structured into Confirmed, Clarification, and Speculative columns.'
            : 'Transcribing speech audio, running candidate extraction, and validating exact transcript grounding.'}
        </p>

        {audioFilename && (
          <div className="pt-1 text-[11px] font-mono text-app-secondary/80 flex items-center justify-center gap-2">
            <FileAudio className="w-3.5 h-3.5 text-app-secondary" />
            <span className="truncate max-w-[200px]">{audioFilename}</span>
            {fileSizeKb && <span>({fileSizeKb} KB)</span>}
          </div>
        )}
      </div>

      {/* Honest 5-Step Progress Timeline */}
      <div className="w-full max-w-lg p-5 rounded-xl border border-app-border bg-app-elevated/40 space-y-3.5">
        <div className="flex items-center justify-between text-[11px] font-mono border-b border-app-border/60 pb-2 text-app-secondary">
          <span>PIPELINE EXECUTION TELEMETRY</span>
          <span className="text-app-accent font-semibold">
            {status === 'error'
              ? 'FAILED'
              : status === 'success'
              ? 'COMPLETED'
              : `STEP ${Math.min(currentStage + 1, PROCESSING_STEPS.length)} OF ${PROCESSING_STEPS.length}`}
          </span>
        </div>

        <div className="space-y-3 pt-1">
          {PROCESSING_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStage || status === 'success';
            const isCurrent = idx === currentStage && status === 'processing';
            const isPending = idx > currentStage && status !== 'success';
            const isFailed = idx === currentStage && status === 'error';

            return (
              <div
                key={step.id}
                className={cn(
                  'flex items-start gap-3 text-xs transition-opacity duration-200',
                  isCompleted
                    ? 'text-app-primary'
                    : isCurrent
                    ? 'text-app-accent font-medium'
                    : isFailed
                    ? 'text-red-500 font-medium'
                    : 'text-app-secondary/40'
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-app-accent" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 animate-spin text-app-accent" />
                  ) : isFailed ? (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-app-border flex items-center justify-center text-[9px] font-mono text-app-secondary/60">
                      {idx + 1}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs leading-none font-medium">{step.label}</p>
                    <span className="text-[10px] font-mono text-app-secondary/70">
                      {isCompleted
                        ? 'Done'
                        : isCurrent
                        ? 'In progress...'
                        : isFailed
                        ? 'Error'
                        : 'Pending'}
                    </span>
                  </div>
                  <p className="text-[11px] text-app-secondary mt-1 leading-snug">
                    {step.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error state message & meaningful recovery controls */}
      {status === 'error' && (
        <div className="w-full max-w-lg p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-400 space-y-3 text-center">
          <p className="leading-relaxed">
            {errorMessage || 'Unable to connect to audio analysis endpoint.'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-1">
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-500/50 bg-app-surface text-app-primary hover:bg-app-elevated transition-colors text-xs font-semibold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Analysis</span>
              </button>
            )}
            {onCancel && (
              <button
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-app-border bg-transparent text-app-secondary hover:text-app-primary transition-colors text-xs"
              >
                <span>Back to Recorder</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Subtext provenance disclaimer */}
      <div className="text-center text-[11px] font-mono text-app-secondary/70 flex items-center justify-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-app-accent" />
        <span>Grounded Extraction Protocol • Zero Hallucination Guarantee</span>
      </div>
    </div>
  );
}
