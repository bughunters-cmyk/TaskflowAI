'use client';

import React, { useState, useMemo } from 'react';
import { useWorkspace } from '@/lib/context/workspace-context';
import { ConfirmedTask, ClarificationNeeded, SpeculativeIdea } from '@/types/meeting';
import { MOCK_PARTICIPANTS } from '@/lib/data/mock-meetings';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckSquare,
  Search,
  Filter,
  Share2,
  ExternalLink,
  ShieldCheck,
  Edit2,
  Calendar,
  CheckCircle2,
  Loader2,
  Sparkles,
  ArrowRight,
  HelpCircle,
  AlertCircle,
  Quote,
  UserCheck,
  ArrowUpDown,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { EvidenceModal } from '@/components/dashboard/evidence-modal';
import { TaskEditModal } from '@/components/dashboard/task-edit-modal';
import { TrelloIcon } from '@/components/ui/trello-icon';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

type TabCategory = 'all' | 'confirmed' | 'clarifications' | 'synced' | 'ideas';

export function ActionItemsContent() {
  const { meetings, approveTask, updateTask, resolveClarification, trelloConfig, addToast } = useWorkspace();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabCategory>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'due_date_asc' | 'due_date_desc' | 'confidence'>('due_date_asc');
  const [syncingTaskId, setSyncingTaskId] = useState<string | null>(null);

  // Modals state
  const [evidenceTask, setEvidenceTask] = useState<ConfirmedTask | null>(null);
  const [editingTask, setEditingTask] = useState<ConfirmedTask | null>(null);

  // Clarification inline resolution inputs
  const [selectedOwners, setSelectedOwners] = useState<Record<string, string>>({});
  const [selectedDueDates, setSelectedDueDates] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Extract all confirmed tasks with meeting context
  const allConfirmedTasks = useMemo(() => {
    return meetings.flatMap((m) =>
      m.confirmed_tasks.map((t) => ({ ...t, meetingTitle: m.title, meetingId: m.id }))
    );
  }, [meetings]);

  // Extract all clarifications with meeting context
  const allClarifications = useMemo(() => {
    return meetings.flatMap((m) =>
      m.clarifications_needed.map((c) => ({ ...c, meetingTitle: m.title, meetingId: m.id }))
    );
  }, [meetings]);

  // Extract all speculative ideas with meeting context
  const allIdeas = useMemo(() => {
    return meetings.flatMap((m) =>
      m.speculative_ideas.map((i) => ({ ...i, meetingTitle: m.title, meetingId: m.id }))
    );
  }, [meetings]);

  const syncedCount = allConfirmedTasks.filter((t) => t.trello_status === 'synced').length;
  const pendingClarificationsCount = allClarifications.filter((c) => c.status !== 'resolved').length;

  // Filtered confirmed tasks
  const filteredConfirmedTasks = useMemo(() => {
    return allConfirmedTasks
      .filter((task) => {
        const matchesSearch =
          task.title.toLowerCase().includes(search.toLowerCase()) ||
          task.description.toLowerCase().includes(search.toLowerCase()) ||
          (task.assignee_name && task.assignee_name.toLowerCase().includes(search.toLowerCase()));

        const matchesAssignee =
          assigneeFilter === 'all' ? true : task.assignee_id === assigneeFilter;

        const matchesPriority =
          priorityFilter === 'all' ? true : task.priority === priorityFilter;

        const matchesTab =
          activeTab === 'all'
            ? true
            : activeTab === 'confirmed'
            ? true
            : activeTab === 'synced'
            ? task.trello_status === 'synced'
            : false;

        return matchesSearch && matchesAssignee && matchesPriority && matchesTab;
      })
      .sort((a, b) => {
        if (sortBy === 'due_date_asc') {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        if (sortBy === 'due_date_desc') {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
        }
        if (sortBy === 'confidence') {
          return b.confidence - a.confidence;
        }
        return 0;
      });
  }, [allConfirmedTasks, search, assigneeFilter, priorityFilter, activeTab, sortBy]);

  // Filtered clarifications
  const filteredClarifications = useMemo(() => {
    if (activeTab === 'confirmed' || activeTab === 'synced' || activeTab === 'ideas') {
      return [];
    }
    return allClarifications.filter((c) => {
      const matchesSearch =
        c.question.toLowerCase().includes(search.toLowerCase()) ||
        (c.reason && c.reason.toLowerCase().includes(search.toLowerCase()));
      return matchesSearch && c.status !== 'resolved';
    });
  }, [allClarifications, search, activeTab]);

  // Filtered ideas
  const filteredIdeas = useMemo(() => {
    if (activeTab === 'confirmed' || activeTab === 'clarifications' || activeTab === 'synced') {
      return [];
    }
    return allIdeas.filter((i) => {
      return (
        i.title.toLowerCase().includes(search.toLowerCase()) ||
        (i.description && i.description.toLowerCase().includes(search.toLowerCase()))
      );
    });
  }, [allIdeas, search, activeTab]);

  const handleApprove = async (meetingId: string, taskId: string) => {
    setSyncingTaskId(taskId);
    await approveTask(meetingId, taskId);
    setSyncingTaskId(null);
  };

  const handleResolveClarification = async (meetingId: string, clarificationId: string) => {
    const ownerId = selectedOwners[clarificationId];
    if (!ownerId || resolvingId) return;

    setResolvingId(clarificationId);
    const dueDate = selectedDueDates[clarificationId];
    try {
      await resolveClarification(meetingId, clarificationId, ownerId, dueDate);
      addToast({
        title: 'Ambiguity Resolved',
        message: 'Commitment moved to Confirmed Tasks awaiting approval.',
        type: 'success',
      });
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-app-border pb-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-app-border bg-app-elevated/40 text-[11px] font-mono text-app-secondary">
            <span>Execution Central</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-app-primary">
            Action Items & Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-app-secondary">
            Centralized accountability register across all workspace meeting sessions.
          </p>
        </div>

        {/* Global Task Counters */}
        <div className="flex items-center gap-3 text-xs font-mono text-app-secondary shrink-0">
          <span className="flex items-center gap-1 text-app-accent font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {allConfirmedTasks.length} Confirmed
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 text-amber-500">
            <HelpCircle className="w-3.5 h-3.5" />
            {pendingClarificationsCount} Clarity
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 text-blue-400">
            <TrelloIcon className="w-3.5 h-3.5" />
            {syncedCount} Synced
          </span>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 border-b border-app-border pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={cn(
            'px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0',
            activeTab === 'all'
              ? 'bg-app-elevated text-app-primary font-semibold shadow-2xs border border-app-border'
              : 'text-app-secondary hover:text-app-primary'
          )}
        >
          All Items ({allConfirmedTasks.length + pendingClarificationsCount + allIdeas.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('confirmed')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0',
            activeTab === 'confirmed'
              ? 'bg-app-accent-subtle text-app-accent font-semibold border border-app-accent/30 shadow-2xs'
              : 'text-app-secondary hover:text-app-primary'
          )}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-app-accent" />
          <span>Confirmed ({allConfirmedTasks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('clarifications')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0',
            activeTab === 'clarifications'
              ? 'bg-amber-500/10 text-amber-500 font-semibold border border-amber-500/30 shadow-2xs'
              : 'text-app-secondary hover:text-app-primary'
          )}
        >
          <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
          <span>Needs Clarity ({pendingClarificationsCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('synced')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0',
            activeTab === 'synced'
              ? 'bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/30 shadow-2xs'
              : 'text-app-secondary hover:text-app-primary'
          )}
        >
          <TrelloIcon className="w-3.5 h-3.5 text-blue-400" />
          <span>Synced to Trello ({syncedCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ideas')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0',
            activeTab === 'ideas'
              ? 'bg-violet-500/10 text-violet-400 font-semibold border border-violet-500/30 shadow-2xs'
              : 'text-app-secondary hover:text-app-primary'
          )}
        >
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          <span>Speculative Ideas ({allIdeas.length})</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3.5 rounded-2xl border border-app-border bg-app-surface shadow-xs flex flex-wrap items-center gap-3 text-xs">
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-app-border bg-app-elevated/40 flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-app-secondary shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks, commitments, questions, owners..."
            className="w-full bg-transparent text-xs text-app-primary placeholder:text-app-secondary outline-hidden"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-[10px] font-mono text-app-secondary hover:text-app-primary"
            >
              Clear
            </button>
          )}
        </div>

        {/* Assignee Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-app-secondary">Owner:</span>
          <div className="w-40">
            <Select
              value={assigneeFilter}
              onValueChange={(val) => setAssigneeFilter(val)}
            >
              <SelectTrigger className="h-8 bg-app-elevated/60">
                <SelectValue placeholder="All Members" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Team Members</SelectItem>
                {MOCK_PARTICIPANTS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-app-secondary">Priority:</span>
          <div className="w-32">
            <Select
              value={priorityFilter}
              onValueChange={(val) => setPriorityFilter(val)}
            >
              <SelectTrigger className="h-8 bg-app-elevated/60">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sort By Due Date */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-app-secondary">Sort:</span>
          <div className="w-36">
            <Select
              value={sortBy}
              onValueChange={(val) => setSortBy(val as any)}
            >
              <SelectTrigger className="h-8 bg-app-elevated/60">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due_date_asc">Due Date: Earliest</SelectItem>
                <SelectItem value="due_date_desc">Due Date: Furthest</SelectItem>
                <SelectItem value="confidence">Confidence Score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Action Items List */}
      <div className="space-y-3">
        {filteredConfirmedTasks.length === 0 &&
        filteredClarifications.length === 0 &&
        filteredIdeas.length === 0 ? (
          <div className="p-12 text-center text-xs text-app-secondary border border-dashed border-app-border rounded-2xl bg-app-surface">
            <CheckSquare className="w-8 h-8 text-app-secondary/40 mx-auto mb-2" />
            <p className="font-semibold text-app-primary text-sm">No action items match criteria</p>
            <p className="mt-1">Try adjusting your filters or recording a new meeting session.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 1. Confirmed Tasks Cards */}
            {filteredConfirmedTasks.map((task) => {
              const isSynced = task.trello_status === 'synced';
              const isSyncing = syncingTaskId === task.id;

              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className={cn(
                    'p-4 sm:p-5 rounded-2xl border bg-app-surface transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs',
                    isSynced
                      ? 'border-app-accent/20 bg-app-accent-subtle/5'
                      : 'border-app-border hover:border-app-border/80 hover:bg-app-elevated/30'
                  )}
                >
                  {/* Left: Task Details */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border',
                          task.priority === 'high'
                            ? 'border-amber-500/30 text-amber-500 bg-amber-500/10'
                            : 'border-app-border text-app-secondary bg-app-elevated/50'
                        )}
                      >
                        {task.priority || 'medium'}
                      </span>

                      <Link
                        href={`/meetings?id=${task.meetingId}`}
                        className="text-[10px] font-mono text-app-secondary hover:text-app-primary bg-app-elevated/50 px-2 py-0.5 rounded border border-app-border truncate max-w-[220px]"
                        title={`Meeting: ${task.meetingTitle}`}
                      >
                        Session: {task.meetingTitle}
                      </Link>

                      {isSynced ? (
                        <span className="text-[10px] font-mono text-app-accent flex items-center gap-1 bg-app-accent-subtle px-2 py-0.5 rounded-full border border-app-accent/30 font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          Synced to Trello
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-app-secondary bg-app-elevated px-2 py-0.5 rounded border border-app-border">
                          Ready for Approval
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-semibold text-app-primary leading-snug">
                      {task.title}
                    </h3>

                    {task.description && (
                      <p className="text-xs text-app-secondary line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    {/* Metadata line */}
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-app-secondary font-mono">
                      <span className="text-app-primary font-medium">
                        Assignee: {task.assignee_name || 'Unassigned'}
                      </span>
                      {task.due_date && (
                        <>
                          <span>•</span>
                          <span>Due: {formatDate(task.due_date)}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>Confidence: {Math.round(task.confidence * 100)}%</span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-app-border/40">
                    <button
                      type="button"
                      onClick={() => setEvidenceTask(task)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-app-border bg-app-elevated/40 text-app-secondary hover:text-app-primary hover:bg-app-elevated text-xs transition-colors"
                      title="Inspect supporting transcript quotation"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-app-accent" />
                      <span>Evidence</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingTask(task)}
                      disabled={isSynced}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-app-border text-xs transition-colors',
                        isSynced
                          ? 'text-app-secondary/40 cursor-not-allowed bg-app-elevated/20'
                          : 'bg-app-elevated/40 text-app-secondary hover:text-app-primary hover:bg-app-elevated'
                      )}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    {isSynced ? (
                      <a
                        href={task.trello_card_url || 'https://trello.com'}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-app-border bg-app-elevated text-app-accent hover:border-app-accent/40 text-xs font-semibold transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Trello Card</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleApprove(task.meetingId, task.id)}
                        disabled={isSyncing}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-app-accent text-black font-semibold text-xs hover:opacity-95 transition-all shadow-md active:scale-95 shadow-[0_0_12px_rgba(190,255,83,0.25)]"
                      >
                        {isSyncing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Pushing...</span>
                          </>
                        ) : (
                          <>
                            <TrelloIcon className="w-3.5 h-3.5" />
                            <span>Approve & Push</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* 2. Needs Clarification Cards (if viewing All or Clarifications) */}
            {filteredClarifications.map((item) => {
              const isResolving = resolvingId === item.id;
              const currentOwner = selectedOwners[item.id] || '';
              const currentDueDate = selectedDueDates[item.id] || '';

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="p-4 sm:p-5 rounded-2xl border border-amber-500/30 bg-app-surface hover:border-amber-500/50 transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-500 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Ambiguity Needs Resolution
                      </span>

                      <Link
                        href={`/meetings?id=${item.meetingId}`}
                        className="text-[10px] font-mono text-app-secondary hover:text-app-primary bg-app-elevated/50 px-2 py-0.5 rounded border border-app-border truncate max-w-[220px]"
                      >
                        Session: {item.meetingTitle}
                      </Link>
                    </div>

                    <h3 className="text-sm font-semibold text-app-primary leading-snug">
                      {item.question}
                    </h3>

                    {item.reason && (
                      <p className="text-xs text-app-secondary line-clamp-2 leading-relaxed">
                        {item.reason}
                      </p>
                    )}

                    {item.source_quote && (
                      <p className="text-[11px] italic font-serif text-app-secondary/90 line-clamp-1 pt-0.5">
                        &ldquo;{item.source_quote}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Resolution Controls */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-app-border/40">
                    <div className="w-full sm:w-44">
                      <Select
                        value={currentOwner}
                        onValueChange={(val) => setSelectedOwners((prev) => ({ ...prev, [item.id]: val }))}
                      >
                        <SelectTrigger className="h-8 bg-app-elevated text-xs">
                          <SelectValue placeholder="Designate owner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {MOCK_PARTICIPANTS.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleResolveClarification(item.meetingId, item.id)}
                      disabled={!currentOwner || isResolving}
                      className={cn(
                        'flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs active:scale-95',
                        !currentOwner || isResolving
                          ? 'bg-app-elevated text-app-secondary/60 cursor-not-allowed border border-app-border'
                          : 'bg-amber-500 text-black hover:opacity-90 shadow-[0_0_12px_rgba(245,189,98,0.3)]'
                      )}
                    >
                      {isResolving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Resolving...</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Resolve Item</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {/* 3. Speculative Ideas Cards (if viewing All or Ideas) */}
            {filteredIdeas.map((idea) => (
              <motion.div
                key={idea.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="p-4 sm:p-5 rounded-2xl border border-dashed border-violet-500/30 bg-app-surface hover:border-violet-500/50 transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-400 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {idea.category || 'Exploratory Brainstorm'}
                    </span>

                    <span className="text-[10px] font-mono text-app-secondary bg-app-elevated/40 px-2 py-0.5 rounded border border-app-border">
                      Session: {idea.meetingTitle}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-app-primary leading-snug">
                    {idea.title}
                  </h3>

                  {idea.description && (
                    <p className="text-xs text-app-secondary line-clamp-2 leading-relaxed">
                      {idea.description}
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-[10px] font-mono text-app-secondary/80 bg-app-elevated/40 px-2.5 py-1 rounded-lg border border-app-border">
                    Display Only • Never Synced
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Decision Provenance Modal */}
      <EvidenceModal task={evidenceTask} onClose={() => setEvidenceTask(null)} />

      {/* Edit Task Modal */}
      <TaskEditModal
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={(updated) => {
          if (editingTask) {
            updateTask(editingTask.meeting_id, editingTask.id, updated);
          }
        }}
      />
    </div>
  );
}

export default function ActionItemsPage() {
  return <ActionItemsContent />;
}
