'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWorkspace } from '@/lib/context/workspace-context';
import { MeetingIntelligenceBoard } from '@/components/dashboard/meeting-intelligence-board';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  Clock,
  Plus,
  Mic,
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatDate, formatTime, formatDuration } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

function MeetingsDirectory() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { meetings, selectMeeting } = useWorkspace();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs_clarity' | 'verified'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'tasks' | 'duration'>('newest');

  const queryId = searchParams.get('id');

  // Filter and sort meetings
  const filteredMeetings = useMemo(() => {
    return meetings
      .filter((m) => {
        const matchesSearch =
          m.title.toLowerCase().includes(search.toLowerCase()) ||
          m.summary.toLowerCase().includes(search.toLowerCase());

        const hasPending = m.clarifications_needed.some((c) => c.status !== 'resolved');
        const matchesStatus =
          statusFilter === 'all'
            ? true
            : statusFilter === 'needs_clarity'
            ? hasPending
            : !hasPending;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        }
        if (sortBy === 'tasks') {
          return b.confirmed_tasks.length - a.confirmed_tasks.length;
        }
        if (sortBy === 'duration') {
          return b.duration_seconds - a.duration_seconds;
        }
        return 0;
      });
  }, [meetings, search, statusFilter, sortBy]);

  const handleSelectMeeting = (id: string) => {
    selectMeeting(id);
    router.push(`/meetings?id=${id}`);
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-app-border pb-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-app-border bg-app-elevated/40 text-xs font-mono text-app-secondary">
            <span>Historical Intelligence Records</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-app-primary">
            Meeting Sessions
          </h1>
          <p className="text-sm sm:text-[15px] text-app-secondary">
            Browse, inspect, and execute accountability items from recorded conference calls.
          </p>
        </div>

        <Link
          href="/recording"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-app-accent text-black font-semibold text-sm hover:opacity-95 transition-all shadow-md active:scale-95 shadow-[0_0_14px_rgba(190,255,83,0.3)] shrink-0 self-start sm:self-auto ring-1 ring-app-accent"
        >
          <Plus className="w-4 h-4" />
          <span>New Recording</span>
        </Link>
      </div>

      {/* Filter, Search & Sort Bar */}
      <div className="p-4 rounded-2xl border border-app-border bg-app-surface shadow-xs flex flex-wrap items-center gap-3.5 text-sm">
        {/* Search */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-app-border bg-app-elevated/40 flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-app-secondary shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search meeting topics, transcript summaries..."
            className="w-full bg-transparent text-sm text-app-primary placeholder:text-app-secondary outline-hidden"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-xs font-mono text-app-secondary hover:text-app-primary px-1.5"
            >
              Clear
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-[13px] font-mono text-app-secondary">Status:</span>
          <div className="w-40">
            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val as any)}
            >
              <SelectTrigger className="h-9 bg-app-elevated/60 text-sm">
                <SelectValue placeholder="All Sessions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sessions</SelectItem>
                <SelectItem value="needs_clarity">Needs Clarity</SelectItem>
                <SelectItem value="verified">Fully Verified</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sort By */}
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-[13px] font-mono text-app-secondary">Sort:</span>
          <div className="w-40">
            <Select
              value={sortBy}
              onValueChange={(val) => setSortBy(val as any)}
            >
              <SelectTrigger className="h-9 bg-app-elevated/60 text-sm">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="tasks">Most Tasks</SelectItem>
                <SelectItem value="duration">Duration</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Meetings Grid / Cards */}
      <div className="space-y-3">
        {filteredMeetings.length === 0 ? (
          <div className="p-12 text-center text-xs text-app-secondary border border-dashed border-app-border rounded-2xl bg-app-surface">
            <Calendar className="w-8 h-8 text-app-secondary/40 mx-auto mb-2" />
            <p className="font-semibold text-app-primary text-sm">No meeting sessions found</p>
            <p className="mt-1 max-w-sm mx-auto">
              {search
                ? 'No meetings matched your search criteria. Try modifying your search or clear filters.'
                : 'Start your first recording session to generate actionable intelligence.'}
            </p>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="mt-3 px-3 py-1.5 rounded-lg border border-app-border bg-app-elevated text-xs font-mono text-app-accent hover:border-app-accent/40"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredMeetings.map((m, idx) => {
              const pendingCount = m.clarifications_needed.filter(
                (c) => c.status !== 'resolved'
              ).length;
              const syncedCount = m.confirmed_tasks.filter(
                (t) => t.trello_status === 'synced'
              ).length;

              return (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.04, 0.2) }}
                  whileHover={{ y: -1 }}
                  className="group p-5 rounded-2xl border border-app-border bg-app-surface hover:border-app-border/90 hover:bg-app-elevated/30 transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                  onClick={() => handleSelectMeeting(m.id)}
                >
                  {/* Left: Meeting Info */}
                  <div className="space-y-2.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-xs font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-app-accent/30 bg-app-accent-subtle text-app-accent font-semibold flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Grounded
                      </span>

                      {m.reused && (
                        <span className="text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                          Cached Audio Hash
                        </span>
                      )}

                      {pendingCount > 0 ? (
                        <span className="text-xs font-mono text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-medium">
                          <HelpCircle className="w-3.5 h-3.5" />
                          {pendingCount} Needs Clarity
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-app-secondary bg-app-elevated px-2.5 py-0.5 rounded-full border border-app-border">
                          All Clear
                        </span>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-semibold text-app-primary group-hover:text-app-accent transition-colors leading-snug">
                      {m.title}
                    </h3>

                    <p className="text-sm text-app-secondary line-clamp-2 leading-relaxed">
                      {m.summary}
                    </p>

                    {/* Metadata line */}
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs sm:text-[13px] text-app-secondary font-mono">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(m.date)} at {formatTime(m.date)}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(m.duration_seconds)}
                      </span>
                      {m.participants && m.participants.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            {m.participants.length} attendees
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Metrics & Action */}
                  <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-3.5 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-app-border/40">
                    <div className="flex items-center gap-3.5 text-sm font-mono">
                      <div className="flex items-center gap-1.5 text-app-accent font-semibold" title="Confirmed tasks">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{m.confirmed_tasks.length}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-amber-500 font-semibold" title="Clarifications needed">
                        <HelpCircle className="w-4 h-4" />
                        <span>{pendingCount}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-violet-400 font-semibold" title="Speculative ideas">
                        <Sparkles className="w-4 h-4" />
                        <span>{m.speculative_ideas.length}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectMeeting(m.id);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-app-border bg-app-elevated/60 text-sm font-medium text-app-primary group-hover:border-app-accent/50 group-hover:bg-app-accent group-hover:text-black transition-all"
                    >
                      <span>Open Workspace</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function MeetingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { meetings, currentMeeting, selectMeeting } = useWorkspace();

  const queryId = searchParams.get('id');

  useEffect(() => {
    if (queryId && meetings.some((m) => m.id === queryId)) {
      selectMeeting(queryId);
    }
  }, [queryId, meetings, selectMeeting]);

  // If no specific meeting query id is in URL, show the Meetings Directory!
  if (!queryId || !currentMeeting) {
    return <MeetingsDirectory />;
  }

  // When meeting ID is active, show the Meeting Intelligence Board with a quick return to Directory!
  return (
    <div className="flex flex-col h-full select-none">
      {/* Session Quick Switcher Bar */}
      <div className="px-5 py-2.5 sm:px-8 sm:py-3 border-b border-app-border bg-app-elevated/40 flex items-center justify-between text-xs sm:text-sm gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.push('/meetings')}
            className="flex items-center gap-1.5 text-xs sm:text-sm text-app-secondary hover:text-app-primary font-mono transition-colors shrink-0"
            title="Return to meetings directory"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">All Sessions</span>
          </button>

          <span className="text-app-secondary/60 hidden sm:inline">•</span>

          <span className="text-app-secondary font-mono text-xs sm:text-[13px] whitespace-nowrap hidden md:inline">
            Active:
          </span>

          <div className="min-w-0 max-w-[240px] xs:max-w-[300px] sm:max-w-[360px]">
            <Select
              value={currentMeeting.id}
              onValueChange={(val) => {
                selectMeeting(val);
                router.push(`/meetings?id=${val}`);
              }}
            >
              <SelectTrigger className="h-8.5 sm:h-9 bg-app-surface text-xs sm:text-sm truncate max-w-full rounded-xl">
                <SelectValue placeholder="Select session" />
              </SelectTrigger>
              <SelectContent>
                {meetings.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="truncate block max-w-[320px]" title={m.title}>
                      {m.title}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => router.push('/meetings')}
            className="text-xs sm:text-sm font-mono text-app-secondary hover:text-app-primary hidden xs:inline"
          >
            Directory
          </button>

          <Link
            href="/recording"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-app-border bg-app-surface hover:bg-app-elevated text-xs sm:text-sm font-mono text-app-accent hover:border-app-accent/40 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Recording</span>
          </Link>
        </div>
      </div>

      {/* Main Intelligence Board */}
      <div className="flex-1 min-h-0">
        <MeetingIntelligenceBoard meeting={currentMeeting} />
      </div>
    </div>
  );
}

export default function MeetingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-app-secondary font-mono">
          Loading meeting intelligence workspace...
        </div>
      }
    >
      <MeetingsContent />
    </Suspense>
  );
}
