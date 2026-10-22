'use client';

import React, { useState, useEffect } from 'react';
import { ConfirmedTask } from '@/types/meeting';
import { useWorkspace } from '@/lib/context/workspace-context';
import {
  CheckCircle2,
  Calendar,
  ExternalLink,
  Edit2,
  ShieldCheck,
  Loader2,
  Quote,
  Check,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { TaskEditModal } from '@/components/dashboard/task-edit-modal';
import { TrelloIcon } from '@/components/ui/trello-icon';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmedTasksColumnProps {
  tasks: ConfirmedTask[];
  onApprove: (taskId: string) => Promise<boolean>;
  onUpdate: (taskId: string, updates: Partial<ConfirmedTask>) => void;
  selectedTaskIds?: string[];
  onToggleSelectTask?: (taskId: string) => void;
  onSelectAllTasks?: (select: boolean) => void;
  newlyResolvedTaskId?: string | null;
}

export function ConfirmedTasksColumn({
  tasks,
  onApprove,
  onUpdate,
  selectedTaskIds = [],
  onToggleSelectTask,
  onSelectAllTasks,
  newlyResolvedTaskId,
}: ConfirmedTasksColumnProps) {
  const { openInspector } = useWorkspace();
  const [editingTask, setEditingTask] = useState<ConfirmedTask | null>(null);
  const [syncingTaskId, setSyncingTaskId] = useState<string | null>(null);
  const [justPublishedIds, setJustPublishedIds] = useState<string[]>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const unpublishedTasks = tasks.filter((t) => t.trello_status !== 'synced');
  const allSelected =
    unpublishedTasks.length > 0 &&
    unpublishedTasks.every((t) => selectedTaskIds.includes(t.id));

  const handleApprove = async (taskId: string) => {
    if (syncingTaskId) return;
    setSyncingTaskId(taskId);
    const success = await onApprove(taskId);
    setSyncingTaskId(null);

    if (success) {
      setJustPublishedIds((prev) => [...prev, taskId]);
      setTimeout(() => {
        setJustPublishedIds((prev) => prev.filter((id) => id !== taskId));
      }, 700);
    }
  };

  const toggleExpand = (taskId: string) => {
    setExpandedTaskId((prev) => (prev === taskId ? null : taskId));
  };

  return (
    <div className="flex flex-col h-full bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-xs">
      {/* Sticky Column Header */}
      <div className="sticky top-0 z-10 px-5 py-4 border-b border-app-border bg-app-surface/95 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full bg-app-accent shadow-[0_0_10px_rgba(190,255,83,0.6)]" />
          <h2 className="text-lg sm:text-[19px] font-semibold text-app-primary">
            Confirmed Tasks
          </h2>
          <span className="text-xs sm:text-[12.5px] font-mono px-2.5 py-0.5 rounded-full border border-app-accent/30 bg-app-accent-subtle text-app-accent font-bold">
            {tasks.length}
          </span>
        </div>

        {/* Select All Checkbox for eligible tasks */}
        {unpublishedTasks.length > 0 && onSelectAllTasks && (
          <button
            type="button"
            onClick={() => onSelectAllTasks(!allSelected)}
            className="flex items-center gap-2 text-xs sm:text-[13px] font-mono text-app-secondary hover:text-app-primary transition-colors py-1 px-2 rounded-lg hover:bg-app-elevated/40"
            title={allSelected ? 'Deselect all' : 'Select all unpublished'}
          >
            {allSelected ? (
              <CheckSquare className="w-4 h-4 text-app-accent" />
            ) : (
              <Square className="w-4 h-4 text-app-secondary" />
            )}
            <span className="hidden sm:inline">Select All ({unpublishedTasks.length})</span>
          </button>
        )}
      </div>

      {/* Tasks List */}
      <div className="flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto min-h-0">
        {tasks.length === 0 ? (
          <div className="py-16 text-center text-sm text-app-secondary px-6 border border-dashed border-app-border rounded-2xl bg-app-surface/60">
            <CheckCircle2 className="w-9 h-9 text-app-secondary/40 mx-auto mb-3" />
            <p className="font-semibold text-app-primary text-base">No confirmed tasks</p>
            <p className="text-sm text-app-secondary mt-1.5 max-w-xs mx-auto leading-relaxed">
              Confirmed commitments will appear here ready for human approval and execution.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {tasks.map((task, idx) => {
              const isSynced = task.trello_status === 'synced';
              const isSyncing = syncingTaskId === task.id || task.trello_status === 'syncing';
              const isSelected = selectedTaskIds.includes(task.id);
              const isExpanded = expandedTaskId === task.id;
              const isJustPublished = justPublishedIds.includes(task.id);
              const isNewlyResolved = newlyResolvedTaskId === task.id;
              const confidencePercent = Math.round((task.confidence ?? 0.95) * 100);

              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    boxShadow: isJustPublished
                      ? '0 0 24px rgba(190,255,83,0.45)'
                      : isNewlyResolved
                      ? '0 0 18px rgba(190,255,83,0.35)'
                      : '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.2) }}
                  whileHover={{ y: -2 }}
                  className={cn(
                    'group relative p-5 sm:p-6 rounded-2xl border transition-all duration-200 bg-app-surface text-app-primary space-y-3.5',
                    isSynced
                      ? 'border-app-accent/35 bg-app-accent-subtle/5'
                      : isSelected
                      ? 'border-app-accent ring-1.5 ring-app-accent/70 bg-app-accent-subtle/10'
                      : 'border-app-border hover:border-app-border/90 hover:bg-app-elevated/30',
                    isNewlyResolved && 'ring-2 ring-app-accent'
                  )}
                >
                  {/* Top Meta: Selection Checkbox, Badges, Edit Button, Expand Toggle */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Checkbox for unpublished tasks */}
                      {!isSynced && onToggleSelectTask && (
                        <button
                          type="button"
                          onClick={() => onToggleSelectTask(task.id)}
                          className="text-app-secondary hover:text-app-accent transition-colors shrink-0 p-0.5"
                          aria-label={`Select task ${task.title}`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4.5 h-4.5 text-app-accent" />
                          ) : (
                            <Square className="w-4.5 h-4.5 text-app-secondary/60 hover:text-app-secondary" />
                          )}
                        </button>
                      )}

                      <span
                        className={cn(
                          'text-xs sm:text-[12.5px] font-mono font-medium uppercase tracking-wider px-2.5 py-0.5 rounded-md border',
                          task.priority === 'high'
                            ? 'border-amber-500/35 text-amber-500 bg-amber-500/10'
                            : 'border-app-border text-app-secondary bg-app-elevated/60'
                        )}
                      >
                        {task.priority || 'normal'}
                      </span>

                      <span className="text-xs sm:text-[12.5px] font-mono text-app-accent flex items-center gap-1.5 bg-app-accent-subtle px-2.5 py-0.5 rounded-md border border-app-accent/30 font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{confidencePercent}%</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Quick Edit */}
                      {!isSynced && (
                        <button
                          type="button"
                          onClick={() => setEditingTask(task)}
                          className="p-1.5 rounded-lg text-app-secondary hover:text-app-primary hover:bg-app-elevated transition-colors"
                          title="Edit task parameters"
                          aria-label="Edit task parameters"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Expand / Collapse Button */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(task.id)}
                        className="p-1.5 rounded-lg text-app-secondary hover:text-app-primary hover:bg-app-elevated transition-colors"
                        title={isExpanded ? 'Collapse card' : 'Expand full details'}
                        aria-label={isExpanded ? 'Collapse card' : 'Expand full details'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-app-accent" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Task Title & Description */}
                  <div className="space-y-1.5">
                    <h3
                      onClick={() => toggleExpand(task.id)}
                      className="text-base sm:text-[17px] font-semibold text-app-primary leading-snug cursor-pointer hover:text-app-accent transition-colors"
                    >
                      {task.title}
                    </h3>

                    {task.description && (
                      <p
                        className={cn(
                          'text-sm sm:text-[14.5px] text-app-secondary leading-relaxed transition-all',
                          !isExpanded && 'line-clamp-2 sm:line-clamp-3'
                        )}
                      >
                        {task.description}
                      </p>
                    )}
                  </div>

                  {/* Evidence Preview Strip (Clickable Drawer Trigger) */}
                  {task.source_quote && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => openInspector(task, task.evidence_chunk_index)}
                        className="w-full text-left p-2.5 rounded-xl border border-app-border/80 bg-app-elevated/40 hover:border-app-accent/40 hover:bg-app-accent-subtle/10 transition-colors group/evidence flex items-start justify-between gap-3"
                        title="Open context in full transcript drawer"
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <Quote className="w-4 h-4 text-app-accent shrink-0 mt-0.5" />
                          <p
                            className={cn(
                              'text-sm italic text-app-secondary leading-relaxed',
                              !isExpanded && 'line-clamp-2'
                            )}
                          >
                            &ldquo;{task.source_quote}&rdquo;
                          </p>
                        </div>
                        <span className="text-sm font-medium text-app-accent shrink-0 group-hover/evidence:underline whitespace-nowrap pt-0.5">
                          View Evidence ↗
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Expanded Additional Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-2 pt-2 border-t border-app-border/60 text-xs sm:text-[13px] font-mono text-app-secondary"
                      >
                        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-app-elevated/50 border border-app-border">
                          <div>
                            <span className="text-app-secondary/60 block text-[11px] uppercase">
                              Grounding Confidence
                            </span>
                            <span className="text-app-accent font-semibold">{confidencePercent}%</span>
                          </div>
                          <div>
                            <span className="text-app-secondary/60 block text-[11px] uppercase">
                              Transcript Chunk
                            </span>
                            <span className="text-app-primary">
                              {task.evidence_chunk_index !== undefined ? `#${task.evidence_chunk_index}` : 'Standard context'}
                            </span>
                          </div>
                          {task.transcript_timestamp && (
                            <div>
                              <span className="text-app-secondary/60 block text-[11px] uppercase">
                                Source Timestamp
                              </span>
                              <span className="text-app-primary">{task.transcript_timestamp}</span>
                            </div>
                          )}
                          {task.speaker && (
                            <div>
                              <span className="text-app-secondary/60 block text-[11px] uppercase">
                                Speaker Identified
                              </span>
                              <span className="text-app-primary">{task.speaker}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Assignee & Due Date Meta Strip */}
                  <div className="pt-3 border-t border-app-border/50 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-app-accent-subtle text-app-accent border border-app-accent/40 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                        {task.assignee_name
                          ? task.assignee_name.split(' ').map((n) => n[0]).join('').substring(0, 2)
                          : 'U'}
                      </div>
                      <span className="text-sm font-medium text-app-primary truncate max-w-[150px]">
                        {task.assignee_name || 'Unassigned'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[13px] sm:text-sm font-mono text-app-secondary shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-app-secondary/80" />
                      <span>{task.due_date ? formatDate(task.due_date) : 'No due date'}</span>
                    </div>
                  </div>

                  {/* Action / Published Status */}
                  <div className="pt-1.5">
                    {isSynced ? (
                      <div className="flex items-center justify-between w-full py-2 px-3 rounded-xl bg-app-accent-subtle/20 border border-app-accent/30 text-sm">
                        <div className="flex items-center gap-2 text-sm font-semibold text-app-accent">
                          <Check className="w-4 h-4 text-app-accent" />
                          <span>Published & Verified</span>
                        </div>
                        {task.trello_card_url && (
                          <a
                            href={task.trello_card_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-sm font-medium text-app-accent hover:underline"
                          >
                            <span>View Card</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleApprove(task.id)}
                        disabled={isSyncing}
                        className={cn(
                          'w-full flex items-center justify-center gap-2.5 h-11 px-4 rounded-xl text-sm font-semibold transition-all duration-200 shadow-xs',
                          isSyncing
                            ? 'bg-app-elevated text-app-secondary cursor-wait border border-app-border'
                            : 'bg-app-accent text-black hover:opacity-95 active:scale-95 shadow-[0_0_14px_rgba(190,255,83,0.25)] ring-1 ring-app-accent'
                        )}
                      >
                        {isSyncing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-app-secondary" />
                            <span>Publishing to Trello...</span>
                          </>
                        ) : (
                          <>
                            <TrelloIcon className="w-4 h-4" />
                            <span>Approve & Push to Trello</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Task Edit Modal */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={(updates) => {
            onUpdate(editingTask.id, updates);
            setEditingTask(null);
          }}
        />
      )}
    </div>
  );
}
