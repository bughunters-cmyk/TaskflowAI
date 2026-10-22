'use client';

import React, { useState, useEffect } from 'react';
import {
  Mic,
  FileText,
  Sparkles,
  CheckCircle2,
  Play,
  Pause,
  ArrowRight,
  ShieldCheck,
  Check,
  Info,
} from 'lucide-react';
import { TrelloIcon } from '@/components/ui/trello-icon';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Stage {
  id: number;
  label: string;
  tagline: string;
  subtext: string;
  icon: React.ElementType;
  accentColor: string;
  borderColor: string;
  bgColor: string;
}

const STAGES: Stage[] = [
  {
    id: 1,
    label: 'Audio Signal',
    tagline: '16kHz Linear PCM Audio',
    subtext: 'High-fidelity audio stream with SHA-256 deduplication to prevent duplicate transcription.',
    icon: Mic,
    accentColor: '#BEFF53',
    borderColor: 'border-[#BEFF53]/50',
    bgColor: 'bg-[#BEFF53]/10',
  },
  {
    id: 2,
    label: 'Transcription',
    tagline: 'Sarvam AI + Groq Fallback',
    subtext: 'Dual-engine speech-to-text with timestamp chunking and speaker diarization.',
    icon: FileText,
    accentColor: '#00E5C3',
    borderColor: 'border-[#00E5C3]/50',
    bgColor: 'bg-[#00E5C3]/10',
  },
  {
    id: 3,
    label: 'AI Extraction',
    tagline: 'Gemini 2.5 Intelligence',
    subtext: 'Extracts Confirmed Tasks, flags Clarifications Needed, and catalogs Speculative Ideas.',
    icon: Sparkles,
    accentColor: '#A78BFA',
    borderColor: 'border-[#A78BFA]/50',
    bgColor: 'bg-[#A78BFA]/10',
  },
  {
    id: 4,
    label: 'Human Review',
    tagline: 'Human-in-the-Loop Grounding',
    subtext: 'Team leads verify commitments, designate owners, set deadlines, and resolve ambiguities.',
    icon: CheckCircle2,
    accentColor: '#FFB547',
    borderColor: 'border-[#FFB547]/50',
    bgColor: 'bg-[#FFB547]/10',
  },
  {
    id: 5,
    label: 'Trello Dispatch',
    tagline: 'Sprint Board Sync & Audit',
    subtext: 'Published directly to Trello sprint list with full supporting transcript quote attached.',
    icon: TrelloIcon,
    accentColor: '#00E5C3',
    borderColor: 'border-[#00E5C3]/50',
    bgColor: 'bg-[#00E5C3]/10',
  },
];

export function WorkflowVisualization() {
  const [activeStep, setActiveStep] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);

  // Auto-cycle through the 5 stages every 1.5 seconds (~5 seconds total cycle)
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setActiveStep((prev) => (prev >= 5 ? 1 : prev + 1));
    }, 1500);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const currentStage = STAGES[activeStep - 1];

  return (
    <div className="p-5 sm:p-6 rounded-2xl border border-[#222F3E] bg-[#101820] shadow-sm select-none space-y-5">
      {/* Header with Title & Play/Pause */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#222F3E]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium text-[#BEFF53] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#BEFF53] shadow-[0_0_8px_rgba(190,255,83,0.7)] animate-pulse" />
              Pipeline Architecture
            </span>
            <span className="text-xs text-[#A8B6C7]/60">•</span>
            <span className="text-xs font-mono text-[#A8B6C7]">Interactive Workflow</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[#F8FAFC]">
            From Conversation to Commitment
          </h3>
          <p className="text-xs sm:text-sm text-[#A8B6C7] max-w-xl">
            How TaskFlow AI transforms spoken conference discussions into auditable, executed engineering tasks.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          className={cn(
            'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-mono transition-all duration-200 shrink-0 self-start sm:self-auto',
            isPlaying
              ? 'border-[#BEFF53]/40 bg-[#BEFF53]/10 text-[#BEFF53] hover:bg-[#BEFF53]/20 shadow-[0_0_12px_rgba(190,255,83,0.2)]'
              : 'border-[#222F3E] bg-[#15202A] text-[#A8B6C7] hover:text-[#F8FAFC]'
          )}
          title={isPlaying ? 'Pause interactive preview' : 'Play interactive preview'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isPlaying ? 'Auto-Cycle Active' : 'Resume Preview'}</span>
        </button>
      </div>

      {/* 5 Connected Pipeline Nodes */}
      <div className="relative pt-2 pb-1">
        {/* Horizontal Connector Line Behind Nodes */}
        <div className="absolute top-1/2 left-8 right-8 -translate-y-1/2 h-1 bg-[#15202A] hidden md:block rounded-full overflow-hidden">
          {/* Animated Traveling Energy Pulse */}
          <motion.div
            className="h-full bg-gradient-to-r from-transparent via-[#BEFF53] to-transparent"
            animate={{
              left: ['-25%', '125%'],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{ width: '25%', position: 'relative' }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-2 relative z-10">
          {STAGES.map((stage) => {
            const Icon = stage.icon;
            const isActive = stage.id === activeStep;
            const isCompleted = stage.id < activeStep;

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => {
                  setActiveStep(stage.id);
                  setIsPlaying(false);
                }}
                className={cn(
                  'group flex flex-col items-center text-center p-3 rounded-2xl border transition-all duration-200 cursor-pointer',
                  isActive
                    ? 'border-[#BEFF53] bg-[#15202A] shadow-md ring-2 ring-[#BEFF53]/30 scale-[1.03]'
                    : isCompleted
                    ? 'border-[#222F3E] bg-[#101820] hover:border-[#BEFF53]/40 hover:bg-[#15202A]/60'
                    : 'border-[#222F3E] bg-[#101820] opacity-75 hover:opacity-100 hover:bg-[#15202A]/40'
                )}
              >
                {/* Node Icon Circle */}
                <div
                  className={cn(
                    'w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 relative',
                    isActive
                      ? 'bg-gradient-to-tr from-[#BEFF53] to-[#00E5C3] text-black shadow-[0_0_16px_rgba(190,255,83,0.45)]'
                      : isCompleted
                      ? 'bg-[#BEFF53]/15 text-[#BEFF53] border border-[#BEFF53]/40'
                      : 'bg-[#15202A] text-[#A8B6C7] border border-[#222F3E]'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {isCompleted && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#BEFF53] text-black flex items-center justify-center text-[10px] font-bold">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>

                {/* Step Index & Name */}
                <div className="mt-2.5 space-y-0.5">
                  <span className="text-[11px] font-mono text-[#A8B6C7] block uppercase tracking-wider">
                    Stage {stage.id}
                  </span>
                  <span
                    className={cn(
                      'text-xs sm:text-sm font-semibold truncate block',
                      isActive ? 'text-[#F8FAFC]' : 'text-[#A8B6C7] group-hover:text-[#F8FAFC]'
                    )}
                  >
                    {stage.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Stage Deep-Dive Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStage.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="p-4 sm:p-5 rounded-xl border border-[#222F3E] bg-[#15202A]/70 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md border border-[#BEFF53]/30 bg-[#BEFF53]/10 text-[#BEFF53]">
                Stage {currentStage.id} of 5
              </span>
              <h4 className="text-sm sm:text-base font-semibold text-[#F8FAFC] truncate">
                {currentStage.tagline}
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-[#A8B6C7] leading-relaxed">
              {currentStage.subtext}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#222F3E] bg-[#101820] text-xs font-mono text-[#A8B6C7]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#00E5C3]" />
              <span>Grounded Verification</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
