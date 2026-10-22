'use client';

import React from 'react';
import { Meeting } from '@/types/meeting';
import { CheckCircle2, HelpCircle, Sparkles } from 'lucide-react';
import { TrelloIcon } from '@/components/ui/trello-icon';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface MeetingMetricsStripProps {
  meeting: Meeting;
  className?: string;
  onFilterClick?: (category: 'confirmed' | 'clarifications' | 'ideas') => void;
  activeCategory?: 'confirmed' | 'clarifications' | 'ideas' | null;
}

export function MeetingMetricsStrip({
  meeting,
  className,
  onFilterClick,
  activeCategory,
}: MeetingMetricsStripProps) {
  const confirmedCount = meeting.confirmed_tasks.length;
  const pendingClarifications = meeting.clarifications_needed.filter(
    (c) => c.status !== 'resolved'
  ).length;
  const ideasCount = meeting.speculative_ideas.length;
  const publishedCount = meeting.confirmed_tasks.filter(
    (t) => t.trello_status === 'synced'
  ).length;

  const publishedPercent =
    confirmedCount > 0 ? Math.round((publishedCount / confirmedCount) * 100) : 0;

  return (
    <div
      className={cn(
        'w-full bg-app-surface/90 border border-app-border rounded-2xl p-2.5 sm:p-3 shadow-xs',
        'grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-3 select-none',
        className
      )}
    >
      {/* Metric 1: Confirmed Tasks */}
      <button
        type="button"
        onClick={() => onFilterClick && onFilterClick('confirmed')}
        className={cn(
          'flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl border text-left transition-all group',
          activeCategory === 'confirmed'
            ? 'bg-app-accent-subtle/25 border-app-accent/50 ring-1 ring-app-accent/30'
            : 'border-app-border/80 bg-app-elevated/30 hover:border-app-border hover:bg-app-elevated/60'
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-app-accent-subtle text-app-accent border border-app-accent/30 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs sm:text-[13px] font-mono text-app-secondary uppercase tracking-wider truncate">
              Confirmed
            </span>
            <span className="text-xs text-app-secondary/70 hidden sm:inline">
              Ready to execute
            </span>
          </div>
        </div>
        <motion.span
          key={`confirmed-${confirmedCount}`}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="font-mono font-bold text-lg sm:text-xl text-app-primary ml-auto pl-2"
        >
          {confirmedCount}
        </motion.span>
      </button>

      {/* Metric 2: Needs Clarification */}
      <button
        type="button"
        onClick={() => onFilterClick && onFilterClick('clarifications')}
        className={cn(
          'flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl border text-left transition-all group',
          activeCategory === 'clarifications'
            ? 'bg-amber-500/15 border-amber-500/50 ring-1 ring-amber-500/30'
            : 'border-app-border/80 bg-app-elevated/30 hover:border-app-border hover:bg-app-elevated/60'
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center justify-center shrink-0">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs sm:text-[13px] font-mono text-app-secondary uppercase tracking-wider truncate">
              Needs Clarity
            </span>
            <span className="text-xs text-app-secondary/70 hidden sm:inline">
              Ambiguous items
            </span>
          </div>
        </div>
        <motion.span
          key={`clarity-${pendingClarifications}`}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'font-mono font-bold text-lg sm:text-xl ml-auto pl-2',
            pendingClarifications > 0 ? 'text-amber-500' : 'text-app-secondary'
          )}
        >
          {pendingClarifications}
        </motion.span>
      </button>

      {/* Metric 3: Speculative Ideas */}
      <button
        type="button"
        onClick={() => onFilterClick && onFilterClick('ideas')}
        className={cn(
          'flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl border text-left transition-all group',
          activeCategory === 'ideas'
            ? 'bg-violet-500/15 border-violet-500/50 ring-1 ring-violet-500/30'
            : 'border-app-border/80 bg-app-elevated/30 hover:border-app-border hover:bg-app-elevated/60'
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs sm:text-[13px] font-mono text-app-secondary uppercase tracking-wider truncate">
              Ideas
            </span>
            <span className="text-xs text-app-secondary/70 hidden sm:inline">
              Brainstorming
            </span>
          </div>
        </div>
        <motion.span
          key={`ideas-${ideasCount}`}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="font-mono font-bold text-lg sm:text-xl text-violet-400 ml-auto pl-2"
        >
          {ideasCount}
        </motion.span>
      </button>

      {/* Metric 4: Published to Trello */}
      <div className="flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl border border-app-border/80 bg-app-elevated/30">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
            <TrelloIcon className="w-4 h-4 text-blue-400" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs sm:text-[13px] font-mono text-app-secondary uppercase tracking-wider truncate">
              Trello Synced
            </span>
            <span className="text-xs text-app-secondary/70 hidden sm:inline">
              Sprint progress
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 ml-auto shrink-0 pl-2">
          {/* Visual progress bar */}
          <div className="w-14 h-2 bg-app-elevated rounded-full overflow-hidden hidden sm:block border border-app-border">
            <div
              className="h-full bg-app-accent transition-all duration-300"
              style={{ width: `${publishedPercent}%` }}
            />
          </div>
          <span className="font-mono font-bold text-lg sm:text-xl text-app-primary">
            {publishedCount}
            <span className="text-xs sm:text-[13px] text-app-secondary font-normal font-sans ml-1">
              /{confirmedCount}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
