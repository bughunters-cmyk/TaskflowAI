'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/lib/context/workspace-context';
import {
  Mic,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Clock,
  Calendar,
  ExternalLink,
  Users,
  ShieldCheck,
  ChevronRight,
  Radio,
  Flame,
  Check,
  Activity,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { TrelloIcon } from '@/components/ui/trello-icon';
import { cn, formatDate, formatTime, formatDuration } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { AiNeuralWaveform } from '@/components/dashboard/ai-neural-waveform';
import { WorkflowVisualization } from '@/components/dashboard/workflow-visualization';
import { RecordingActionCenter } from '@/components/dashboard/recording-action-center';

export function OverviewDashboard() {
  const router = useRouter();
  const { meetings, stats, selectMeeting, trelloConfig } = useWorkspace();
  const [taskFilter, setTaskFilter] = useState<'all' | 'confirmed' | 'clarifications' | 'synced'>('all');
  const [greeting, setGreeting] = useState('Good morning');

  // Dynamic greeting based on user's current local hour
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting('Good morning');
    } else if (hour < 18) {
      setGreeting('Good afternoon');
    } else {
      setGreeting('Good evening');
    }
  }, []);

  // Meetings with pending clarifications
  const meetingsAwaitingReview = useMemo(
    () => meetings.filter((m) => m.clarifications_needed.some((c) => c.status !== 'resolved')),
    [meetings]
  );

  // All tasks flattened across meetings with meeting context
  const allTasks = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      meetingId: string;
      meetingTitle: string;
      assigneeName?: string;
      dueDate?: string | null;
      type: 'confirmed' | 'clarification' | 'speculative' | 'synced';
      cardUrl?: string | null;
    }> = [];

    meetings.forEach((m) => {
      // Confirmed & Synced
      m.confirmed_tasks.forEach((t) => {
        list.push({
          id: t.id,
          title: t.title,
          meetingId: m.id,
          meetingTitle: m.title,
          assigneeName: t.assignee_name || 'Unassigned',
          dueDate: t.due_date,
          type: t.trello_status === 'synced' ? 'synced' : 'confirmed',
          cardUrl: t.trello_card_url,
        });
      });

      // Clarifications needed
      m.clarifications_needed
        .filter((c) => c.status !== 'resolved')
        .forEach((c) => {
          list.push({
            id: c.id,
            title: c.question,
            meetingId: m.id,
            meetingTitle: m.title,
            assigneeName: 'Pending Owner',
            dueDate: null,
            type: 'clarification',
          });
        });

      // Speculative ideas
      m.speculative_ideas.forEach((i) => {
        list.push({
          id: i.id,
          title: i.title,
          meetingId: m.id,
          meetingTitle: m.title,
          assigneeName: 'Exploratory',
          dueDate: null,
          type: 'speculative',
        });
      });
    });

    return list;
  }, [meetings]);

  // Filter tasks for the right-side summary
  const filteredTasks = useMemo(() => {
    if (taskFilter === 'all') return allTasks.slice(0, 7);
    if (taskFilter === 'confirmed') return allTasks.filter((t) => t.type === 'confirmed').slice(0, 7);
    if (taskFilter === 'clarifications') return allTasks.filter((t) => t.type === 'clarification').slice(0, 7);
    if (taskFilter === 'synced') return allTasks.filter((t) => t.type === 'synced').slice(0, 7);
    return allTasks.slice(0, 7);
  }, [allTasks, taskFilter]);

  const publishedPercent =
    stats.confirmed_actions_count > 0
      ? Math.round((stats.synced_tasks_count / stats.confirmed_actions_count) * 100)
      : 0;

  const handleSelectMeeting = (id: string) => {
    selectMeeting(id);
    router.push(`/meetings?id=${id}`);
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 select-none text-[#F8FAFC]">
      {/* 1. HERO SECTION — First 5 Seconds Impression */}
      <section className="relative overflow-hidden p-6 sm:p-10 rounded-3xl border border-[#222F3E] bg-gradient-to-br from-[#101820] via-[#0B1017] to-[#070B10] shadow-2xl">
        {/* Subtle background ambient glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-gradient-to-br from-[#BEFF53]/10 via-[#00E5C3]/10 to-transparent blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Greeting, Value Proposition, Action */}
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#BEFF53]/30 bg-[#BEFF53]/10 text-xs font-mono text-[#BEFF53] shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#BEFF53] shadow-[0_0_8px_rgba(190,255,83,0.8)] animate-pulse" />
              <span>Grounded Meeting Intelligence • V2.2 Active</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#F8FAFC] leading-tight">
              {greeting}, Aditya! 👋
            </h1>

            <p className="text-base sm:text-lg text-[#A8B6C7] max-w-xl leading-relaxed">
              Turn meeting conversations into actionable tasks, so your team can focus on what matters.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <Link
                href="/recording"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-[#BEFF53] text-black font-semibold text-sm hover:opacity-95 shadow-[0_0_24px_rgba(190,255,83,0.35)] hover:shadow-[0_0_32px_rgba(190,255,83,0.5)] active:scale-95 transition-all ring-1 ring-[#BEFF53]"
              >
                <Mic className="w-4.5 h-4.5" />
                <span>Start Recording Session</span>
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </Link>

              <Link
                href="/meetings"
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl border border-[#222F3E] bg-[#15202A]/80 text-[#F8FAFC] font-medium text-sm hover:border-[#BEFF53]/40 hover:bg-[#15202A] transition-all"
              >
                <Calendar className="w-4 h-4 text-[#A8B6C7]" />
                <span>Browse {meetings.length} Sessions</span>
              </Link>
            </div>
          </div>

          {/* Right Column: AI Neural Waveform Centerpiece */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <AiNeuralWaveform onStartRecording={() => router.push('/recording')} />
          </div>
        </div>
      </section>

      {/* 2. ANIMATED INTELLIGENCE METRICS (4 Large Cards) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Meetings */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          whileHover={{ y: -2 }}
          className="p-5 sm:p-6 rounded-2xl border border-[#222F3E] bg-[#101820] shadow-xs space-y-3 hover:border-[#00E5C3]/40 transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] sm:text-base font-semibold text-[#F8FAFC]">
              Total Meetings
            </h3>
            <div className="w-9 h-9 rounded-xl bg-[#00E5C3]/10 border border-[#00E5C3]/30 text-[#00E5C3] flex items-center justify-center">
              <Calendar className="w-4.5 h-4.5" />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <motion.span
              key={`meetings-${meetings.length}`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-[#F8FAFC] tabular-nums"
            >
              {meetings.length}
            </motion.span>
            <span className="text-xs sm:text-sm font-mono text-[#A8B6C7]">recorded sessions</span>
          </div>

          <div className="pt-1 flex items-center gap-1.5 text-xs text-[#A8B6C7] font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00E5C3]" />
            <span>Dual-engine transcribed & grounded</span>
          </div>
        </motion.div>

        {/* Card 2: Confirmed Tasks */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          whileHover={{ y: -2 }}
          className="p-5 sm:p-6 rounded-2xl border border-[#222F3E] bg-[#101820] shadow-xs space-y-3 hover:border-[#BEFF53]/40 transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] sm:text-base font-semibold text-[#F8FAFC]">
              Confirmed Tasks
            </h3>
            <div className="w-9 h-9 rounded-xl bg-[#BEFF53]/10 border border-[#BEFF53]/30 text-[#BEFF53] flex items-center justify-center">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <motion.span
              key={`confirmed-${stats.confirmed_actions_count}`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-[#BEFF53] tabular-nums"
            >
              {stats.confirmed_actions_count}
            </motion.span>
            <span className="text-xs sm:text-sm font-mono text-[#BEFF53] font-medium">commitments</span>
          </div>

          <div className="pt-1 flex items-center gap-1.5 text-xs text-[#A8B6C7] font-mono">
            <Sparkles className="w-3.5 h-3.5 text-[#BEFF53]" />
            <span>Verified speaker action items</span>
          </div>
        </motion.div>

        {/* Card 3: Clarifications Needed */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          whileHover={{ y: -2 }}
          className="p-5 sm:p-6 rounded-2xl border border-[#222F3E] bg-[#101820] shadow-xs space-y-3 hover:border-[#FFB547]/40 transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] sm:text-base font-semibold text-[#F8FAFC]">
              Needs Clarity
            </h3>
            <div className="w-9 h-9 rounded-xl bg-[#FFB547]/10 border border-[#FFB547]/30 text-[#FFB547] flex items-center justify-center">
              <HelpCircle className="w-4.5 h-4.5" />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <motion.span
              key={`clarity-${stats.clarifications_pending_count}`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-[#FFB547] tabular-nums"
            >
              {stats.clarifications_pending_count}
            </motion.span>
            <span className="text-xs sm:text-sm font-mono text-[#FFB547] font-medium">unresolved</span>
          </div>

          <div className="pt-1 flex items-center gap-1.5 text-xs text-[#A8B6C7] font-mono">
            <span>{meetingsAwaitingReview.length} session{meetingsAwaitingReview.length !== 1 ? 's' : ''} awaiting owner resolution</span>
          </div>
        </motion.div>

        {/* Card 4: Published to Trello */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
          whileHover={{ y: -2 }}
          className="p-5 sm:p-6 rounded-2xl border border-[#222F3E] bg-[#101820] shadow-xs space-y-3 hover:border-[#00E5C3]/40 transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] sm:text-base font-semibold text-[#F8FAFC]">
              Published to Trello
            </h3>
            <div className="w-9 h-9 rounded-xl bg-[#00E5C3]/10 border border-[#00E5C3]/30 text-[#00E5C3] flex items-center justify-center">
              <TrelloIcon className="w-4.5 h-4.5 text-[#00E5C3]" />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <motion.span
              key={`synced-${stats.synced_tasks_count}`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-[#00E5C3] tabular-nums"
            >
              {stats.synced_tasks_count}
            </motion.span>
            <span className="text-xs sm:text-sm font-mono text-[#A8B6C7]">
              / {stats.confirmed_actions_count} ({publishedPercent}%)
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-[#15202A] rounded-full overflow-hidden border border-[#222F3E]">
            <div
              className="h-full bg-gradient-to-r from-[#BEFF53] to-[#00E5C3] transition-all duration-500 rounded-full"
              style={{ width: `${publishedPercent}%` }}
            />
          </div>
        </motion.div>
      </section>

      {/* 3. SIGNATURE ANIMATION — "FROM CONVERSATION TO COMMITMENT" */}
      <section>
        <WorkflowVisualization />
      </section>

      {/* 4. MAIN TWO-COLUMN INTELLIGENCE SECTION */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 cols): Recent Meeting Activity + Quick Recording Action Center */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#F8FAFC]">
                Recent Meeting Activity
              </h2>
              <p className="text-xs sm:text-sm text-[#A8B6C7]">
                Live extracted conference intelligence with grounded evidence.
              </p>
            </div>

            <Link
              href="/meetings"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-mono text-[#BEFF53] hover:underline"
            >
              <span>View Directory ({meetings.length})</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Recent Meeting Cards */}
          <div className="space-y-3.5">
            {meetings.slice(0, 4).map((m) => {
              const pendingCount = m.clarifications_needed.filter((c) => c.status !== 'resolved').length;
              return (
                <motion.div
                  key={m.id}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => handleSelectMeeting(m.id)}
                  className="group p-5 rounded-2xl border border-[#222F3E] bg-[#101820] hover:border-[#BEFF53]/50 hover:bg-[#15202A]/80 transition-all duration-200 shadow-xs cursor-pointer space-y-3"
                >
                  {/* Top Line: Badges & Duration */}
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-[#BEFF53]/30 bg-[#BEFF53]/10 text-xs font-mono font-medium text-[#BEFF53]">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Grounded
                      </span>

                      {pendingCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-[#FFB547]/30 bg-[#FFB547]/10 text-xs font-mono text-[#FFB547] font-medium">
                          <HelpCircle className="w-3 h-3" />
                          {pendingCount} Needs Clarity
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full border border-[#222F3E] bg-[#15202A] text-xs font-mono text-[#A8B6C7]">
                          All Clear
                        </span>
                      )}

                      {m.reused && (
                        <span className="text-xs font-mono text-[#FFB547] bg-[#FFB547]/10 border border-[#FFB547]/30 px-2 py-0.5 rounded-full">
                          Cached Audio Hash
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs font-mono text-[#A8B6C7] shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatDuration(m.duration_seconds)}</span>
                    </div>
                  </div>

                  {/* Title & Summary */}
                  <div>
                    <h3 className="text-base sm:text-[17px] font-semibold text-[#F8FAFC] group-hover:text-[#BEFF53] transition-colors leading-snug">
                      {m.title}
                    </h3>
                    <p className="text-sm text-[#A8B6C7] line-clamp-2 leading-relaxed mt-1">
                      {m.summary}
                    </p>
                  </div>

                  {/* Footer Meta & Open Action */}
                  <div className="pt-3 border-t border-[#222F3E]/70 flex items-center justify-between text-xs sm:text-[13px] font-mono text-[#A8B6C7]">
                    <div className="flex items-center gap-3">
                      <span>{formatDate(m.date)} at {formatTime(m.date)}</span>
                      <span>•</span>
                      <span className="text-[#BEFF53] font-semibold">
                        {m.confirmed_tasks.length} confirmed
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[#BEFF53] font-medium group-hover:translate-x-1 transition-transform">
                      <span>Open Meeting</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Dedicated Quick Recording Action Card */}
          <RecordingActionCenter />
        </div>

        {/* Right Column (5 cols): Recent Task Summary & Integration State */}
        <div className="lg:col-span-5 space-y-6">
          {/* Section Header */}
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#F8FAFC]">
              Recent Task Summary
            </h2>
            <p className="text-xs sm:text-sm text-[#A8B6C7]">
              Extracted action items ready for verification & dispatch.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="p-4 sm:p-5 rounded-2xl border border-[#222F3E] bg-[#101820] shadow-sm space-y-4">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
              <button
                type="button"
                onClick={() => setTaskFilter('all')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-colors shrink-0',
                  taskFilter === 'all'
                    ? 'bg-[#BEFF53] text-black font-semibold'
                    : 'bg-[#15202A] text-[#A8B6C7] hover:text-[#F8FAFC]'
                )}
              >
                All ({allTasks.length})
              </button>
              <button
                type="button"
                onClick={() => setTaskFilter('confirmed')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-colors shrink-0',
                  taskFilter === 'confirmed'
                    ? 'bg-[#BEFF53] text-black font-semibold'
                    : 'bg-[#15202A] text-[#A8B6C7] hover:text-[#F8FAFC]'
                )}
              >
                Confirmed
              </button>
              <button
                type="button"
                onClick={() => setTaskFilter('clarifications')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-colors shrink-0',
                  taskFilter === 'clarifications'
                    ? 'bg-[#FFB547] text-black font-semibold'
                    : 'bg-[#15202A] text-[#A8B6C7] hover:text-[#F8FAFC]'
                )}
              >
                Needs Clarity
              </button>
              <button
                type="button"
                onClick={() => setTaskFilter('synced')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-colors shrink-0',
                  taskFilter === 'synced'
                    ? 'bg-[#00E5C3] text-black font-semibold'
                    : 'bg-[#15202A] text-[#A8B6C7] hover:text-[#F8FAFC]'
                )}
              >
                Synced
              </button>
            </div>

            {/* Tasks Feed */}
            <div className="space-y-3">
              {filteredTasks.length === 0 ? (
                <div className="py-12 text-center text-sm text-[#A8B6C7] border border-dashed border-[#222F3E] rounded-xl">
                  No tasks matched the selected filter.
                </div>
              ) : (
                filteredTasks.map((task) => {
                  return (
                    <div
                      key={task.id}
                      onClick={() => handleSelectMeeting(task.meetingId)}
                      className="p-3.5 rounded-xl border border-[#222F3E] bg-[#15202A]/60 hover:border-[#BEFF53]/40 hover:bg-[#15202A] transition-all cursor-pointer space-y-2 group"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <h4 className="text-sm font-semibold text-[#F8FAFC] leading-snug group-hover:text-[#BEFF53] transition-colors flex-1">
                          {task.title}
                        </h4>

                        {/* Status Badges */}
                        {task.type === 'synced' && (
                          <span className="inline-flex items-center gap-1 text-xs font-mono text-[#00E5C3] bg-[#00E5C3]/10 border border-[#00E5C3]/30 px-2 py-0.5 rounded-md shrink-0 font-medium">
                            <Check className="w-3 h-3" />
                            Synced
                          </span>
                        )}
                        {task.type === 'confirmed' && (
                          <span className="inline-flex items-center gap-1 text-xs font-mono text-[#BEFF53] bg-[#BEFF53]/10 border border-[#BEFF53]/30 px-2 py-0.5 rounded-md shrink-0 font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            Confirmed
                          </span>
                        )}
                        {task.type === 'clarification' && (
                          <span className="inline-flex items-center gap-1 text-xs font-mono text-[#FFB547] bg-[#FFB547]/10 border border-[#FFB547]/30 px-2 py-0.5 rounded-md shrink-0 font-medium">
                            <HelpCircle className="w-3 h-3" />
                            Clarity
                          </span>
                        )}
                        {task.type === 'speculative' && (
                          <span className="inline-flex items-center gap-1 text-xs font-mono text-[#A78BFA] bg-[#A78BFA]/10 border border-[#A78BFA]/30 px-2 py-0.5 rounded-md shrink-0 font-medium">
                            <Sparkles className="w-3 h-3" />
                            Idea
                          </span>
                        )}
                      </div>

                      {/* Meta: Assignee, Due Date & Session */}
                      <div className="flex items-center justify-between text-xs font-mono text-[#A8B6C7] pt-1 border-t border-[#222F3E]/60">
                        <div className="flex items-center gap-2 truncate max-w-[200px]">
                          <span>{task.assigneeName}</span>
                          {task.dueDate && (
                            <>
                              <span>•</span>
                              <span>{formatDate(task.dueDate)}</span>
                            </>
                          )}
                        </div>

                        {task.cardUrl ? (
                          <a
                            href={task.cardUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[#00E5C3] hover:underline"
                          >
                            <span>Trello</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[#A8B6C7]/70 truncate max-w-[120px]">
                            {task.meetingTitle}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Link to Action Items */}
            <Link
              href="/action-items"
              className="block w-full py-2.5 text-center text-xs sm:text-sm font-semibold text-[#A8B6C7] hover:text-[#F8FAFC] rounded-xl border border-[#222F3E] bg-[#15202A] hover:bg-[#15202A]/90 transition-colors"
            >
              Manage Action Items Workspace →
            </Link>
          </div>

          {/* Connected Trello Sprint Status Hub */}
          <div className="p-4 sm:p-5 rounded-2xl border border-[#222F3E] bg-[#101820] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                  <TrelloIcon className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#F8FAFC]">Sprint Integration Hub</h4>
                  <p className="text-xs text-[#A8B6C7]">Human-approved dispatch endpoint</p>
                </div>
              </div>

              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-mono font-medium flex items-center gap-1.5',
                  trelloConfig.connected
                    ? 'border border-[#BEFF53]/30 bg-[#BEFF53]/10 text-[#BEFF53]'
                    : 'border border-red-500/30 bg-red-500/10 text-red-400'
                )}
              >
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    trelloConfig.connected ? 'bg-[#BEFF53] shadow-[0_0_6px_rgba(190,255,83,0.8)]' : 'bg-red-400'
                  )}
                />
                {trelloConfig.connected ? 'Connected' : 'Offline'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#15202A] border border-[#222F3E] text-xs font-mono text-[#A8B6C7] space-y-1">
              <div className="flex justify-between">
                <span>Target Board:</span>
                <span className="text-[#F8FAFC] font-medium">{trelloConfig.board_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Target List:</span>
                <span className="text-[#BEFF53] font-medium">{trelloConfig.list_name}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Scope Disclaimer */}
      <footer className="pt-4 border-t border-[#222F3E]/60 text-center text-xs font-mono text-[#A8B6C7]/70 flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-[#BEFF53]" />
        <span>Grounded Intelligence Engine • Verified across active sessions and local client cache</span>
      </footer>
    </div>
  );
}
