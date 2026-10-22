'use client';

import React from 'react';
import Link from 'next/link';
import { Mic, Upload, Sparkles, ArrowRight, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export function RecordingActionCenter() {
  return (
    <div className="relative overflow-hidden p-6 sm:p-8 rounded-2xl border border-[#222F3E] bg-[#101820] shadow-md select-none group">
      {/* Background ambient light */}
      <div className="absolute -top-16 -right-16 w-60 h-60 rounded-full bg-gradient-to-br from-[#BEFF53]/15 via-[#00E5C3]/10 to-transparent blur-3xl pointer-events-none group-hover:scale-125 transition-transform duration-700" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left Side: Glowing Icon & Copy */}
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          {/* Glowing Mic Icon with Signal Pulse */}
          <div className="relative shrink-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-[#BEFF53]/20 via-[#00E5C3]/15 to-[#15202A] border border-[#BEFF53]/40 flex items-center justify-center text-[#BEFF53] shadow-[0_0_24px_rgba(190,255,83,0.25)] group-hover:shadow-[0_0_32px_rgba(190,255,83,0.4)] transition-shadow duration-300">
              <Mic className="w-7 h-7 text-[#BEFF53]" />
            </div>

            {/* Radar / Signal Pulse Ring */}
            <span className="absolute -inset-1 rounded-2xl border border-[#BEFF53]/30 animate-record-pulse pointer-events-none" />
          </div>

          <div className="space-y-1.5 min-w-0">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-[#BEFF53]/30 bg-[#BEFF53]/10 text-xs font-mono text-[#BEFF53]">
              <Radio className="w-3 h-3 text-[#BEFF53] animate-pulse" />
              <span>Real-Time Ingestion</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[#F8FAFC]">
              Start a New Recording
            </h3>
            <p className="text-xs sm:text-sm text-[#A8B6C7] max-w-lg leading-relaxed">
              Capture your next team sprint, standup, or client sync. TaskFlow AI extracts confirmed commitments and synchronizes directly with your workspace.
            </p>
          </div>
        </div>

        {/* Right Side: Dual Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <Link
            href="/recording"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#BEFF53] text-black font-semibold text-sm hover:opacity-95 shadow-[0_0_20px_rgba(190,255,83,0.3)] hover:shadow-[0_0_28px_rgba(190,255,83,0.5)] active:scale-95 transition-all ring-1 ring-[#BEFF53]"
          >
            <Mic className="w-4 h-4" />
            <span>Start Recording</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/recording"
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#222F3E] bg-[#15202A] text-[#F8FAFC] font-medium text-sm hover:border-[#BEFF53]/50 hover:bg-[#15202A]/80 active:scale-95 transition-all"
          >
            <Upload className="w-4 h-4 text-[#A8B6C7]" />
            <span>Upload Audio File</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
