'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface TaskFlowLogoProps {
  className?: string;
  isRecording?: boolean;
  showTagline?: boolean;
}

/**
 * Minimal Waveform-inspired Logo Icon
 * Precision audio visualization bars with subtle pulse animation when recording
 */
export function WaveformLogoIcon({
  isRecording = false,
  className,
}: {
  isRecording?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center w-7 h-7 rounded-lg border transition-all duration-300 shrink-0',
        isRecording
          ? 'bg-red-500/10 border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.35)]'
          : 'bg-[#15191E] border-[#2A3038] group-hover:border-[#BEFF53]/50 group-hover:shadow-[0_0_12px_rgba(190,255,83,0.2)]',
        className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-4 h-4"
        aria-hidden="true"
      >
        {/* 4-bar minimal waveform */}
        <rect
          x="3"
          y="7"
          width="2.5"
          height="10"
          rx="1.25"
          className={cn(
            'transition-all duration-300',
            isRecording
              ? 'fill-red-500 animate-pulse'
              : 'fill-[#BEFF53] opacity-80 group-hover:opacity-100'
          )}
        />
        <rect
          x="8"
          y="3"
          width="2.5"
          height="18"
          rx="1.25"
          className={cn(
            'transition-all duration-300',
            isRecording
              ? 'fill-red-500 animate-pulse'
              : 'fill-[#BEFF53] opacity-100'
          )}
        />
        <rect
          x="13.5"
          y="5.5"
          width="2.5"
          height="13"
          rx="1.25"
          className={cn(
            'transition-all duration-300',
            isRecording
              ? 'fill-red-500 animate-pulse'
              : 'fill-[#BEFF53] opacity-90 group-hover:opacity-100'
          )}
        />
        <rect
          x="19"
          y="8.5"
          width="2.5"
          height="7"
          rx="1.25"
          className={cn(
            'transition-all duration-300',
            isRecording
              ? 'fill-red-500 animate-pulse'
              : 'fill-[#BEFF53] opacity-75 group-hover:opacity-100'
          )}
        />
      </svg>
    </div>
  );
}

/**
 * TaskFlow AI Logo Component (formerly ZIRO)
 * Preserves backwards-compatible export name ZiroLogo while presenting TaskFlow AI branding
 */
export function ZiroLogo({
  className,
  isRecording = false,
  showTagline = false,
}: TaskFlowLogoProps) {
  return (
    <Link
      href="/"
      className={cn('group inline-flex flex-col select-none focus-visible:outline-hidden', className)}
      aria-label="TaskFlow AI Home"
    >
      <div className="flex items-center gap-2.5 whitespace-nowrap">
        {/* Minimal Waveform Icon */}
        <WaveformLogoIcon isRecording={isRecording} />

        {/* Typographic Wordmark: "TaskFlow" in white, "AI" in neon lime */}
        <div className="flex items-baseline tracking-tight font-bold text-base sm:text-[17px] leading-none">
          <span className="text-[#F5F7F8] light:text-[#0E1217] transition-colors">
            TaskFlow
          </span>
          <span className="text-[#BEFF53] light:text-app-accent ml-1 font-black transition-colors">
            AI
          </span>
        </div>

        {/* Version badge */}
        <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-app-accent/30 text-app-accent bg-app-accent-subtle font-semibold shrink-0">
          v2.0
        </span>
      </div>

      {showTagline && (
        <span className="text-[11px] font-normal text-app-secondary tracking-tight mt-1 ml-9">
          From conversation to commitment.
        </span>
      )}
    </Link>
  );
}

// Alias for semantic clarity
export const TaskFlowLogo = ZiroLogo;
