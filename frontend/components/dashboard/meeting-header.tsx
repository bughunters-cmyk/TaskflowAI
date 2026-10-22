'use client';

import React from 'react';
import { Meeting } from '@/types/meeting';
import {
  Calendar,
  Clock,
  Users,
  ShieldCheck,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { TrelloIcon } from '@/components/ui/trello-icon';
import { cn, formatDate, formatTime, formatDuration } from '@/lib/utils';
import Link from 'next/link';

interface MeetingHeaderProps {
  meeting: Meeting;
  selectedCount?: number;
  onOpenBulkApproval?: () => void;
  onToggleTranscript?: () => void;
  isTranscriptOpen?: boolean;
}

export function MeetingHeader({
  meeting,
  selectedCount = 0,
  onOpenBulkApproval,
  onToggleTranscript,
  isTranscriptOpen = false,
}: MeetingHeaderProps) {
  const confirmedCount = meeting.confirmed_tasks.length;
  const unpublishedCount = meeting.confirmed_tasks.filter(
    (t) => t.trello_status !== 'synced'
  ).length;

  return (
    <header className="px-5 py-4 sm:px-8 sm:py-5 border-b border-app-border bg-app-surface/90 backdrop-blur-md select-none space-y-3">
      {/* Top breadcrumb & Status strip */}
      <div className="flex items-center justify-between gap-3 text-xs sm:text-[13px]">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-app-secondary">
          <Link
            href="/meetings"
            className="hover:text-app-primary transition-colors font-medium flex items-center gap-1"
          >
            <span>Meetings</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-app-secondary/60 shrink-0" />
          <span className="font-mono text-xs text-app-secondary/80">
            ID: {meeting.id}
          </span>
          {meeting.reused && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-app-secondary/60 shrink-0" />
              <span className="text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                Cached Audio Hash
              </span>
            </>
          )}
        </nav>

        {/* Processing status pill & Transcript Inspector Toggle */}
        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-app-accent/30 bg-app-accent-subtle text-app-accent font-mono text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Grounded & Verified</span>
          </div>

          {onToggleTranscript && (
            <button
              type="button"
              onClick={onToggleTranscript}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-medium transition-colors',
                isTranscriptOpen
                  ? 'border-app-accent bg-app-accent-subtle text-app-accent'
                  : 'border-app-border bg-app-elevated/40 text-app-secondary hover:text-app-primary hover:bg-app-elevated'
              )}
              title="Toggle Transcript Inspector"
              aria-label="Toggle Transcript Inspector"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Transcript</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Title & Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="space-y-1.5 min-w-0">
          <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-app-primary truncate leading-tight">
            {meeting.title}
          </h1>

          {/* Metadata info */}
          <div className="flex flex-wrap items-center gap-3 text-[13px] sm:text-sm text-app-secondary font-mono">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-app-secondary/70" />
              {formatDate(meeting.date)} at {formatTime(meeting.date)}
            </span>
            <span className="text-app-secondary/40">•</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-app-secondary/70" />
              {formatDuration(meeting.duration_seconds)}
            </span>
            {meeting.participants && meeting.participants.length > 0 && (
              <>
                <span className="text-app-secondary/40">•</span>
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-app-secondary/70" />
                  {meeting.participants.length} attendee{meeting.participants.length > 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Contextual Bulk Action: "Review & Publish Selected" */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          {unpublishedCount > 0 && (
            <button
              type="button"
              onClick={onOpenBulkApproval}
              disabled={selectedCount === 0}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shadow-xs active:scale-95',
                selectedCount > 0
                  ? 'bg-app-accent text-black hover:opacity-95 shadow-[0_0_14px_rgba(190,255,83,0.3)] ring-1 ring-app-accent'
                  : 'border border-app-border bg-app-elevated/40 text-app-secondary/50 cursor-not-allowed opacity-60'
              )}
              title={
                selectedCount > 0
                  ? `Review and publish ${selectedCount} selected tasks`
                  : 'Select tasks using checkboxes below'
              }
            >
              <TrelloIcon className="w-4 h-4" />
              <span>
                {selectedCount > 0
                  ? `Review & Publish Selected (${selectedCount})`
                  : 'Review & Publish Selected'}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
