'use client';

import React, { useState } from 'react';
import { ConfirmedTask } from '@/types/meeting';
import { TrelloIcon } from '@/components/ui/trello-icon';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  User,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface BulkApprovalModalProps {
  tasks: ConfirmedTask[];
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (tasks: ConfirmedTask[]) => Promise<void>;
  boardName?: string;
  listName?: string;
}

export function BulkApprovalModal({
  tasks,
  isOpen,
  onClose,
  onConfirm,
  boardName = 'Core Engineering Sprint Board',
  listName = 'Committed & Verified',
}: BulkApprovalModalProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishingIndex, setPublishingIndex] = useState(0);

  if (!isOpen) return null;

  const handleStartPublish = async () => {
    setIsPublishing(true);
    setPublishingIndex(0);
    try {
      await onConfirm(tasks);
      onClose();
    } catch (e) {
      console.error('Bulk publish error:', e);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-approval-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none"
      onClick={!isPublishing ? onClose : undefined}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-xl rounded-2xl border border-app-border bg-[#15191E] text-app-primary shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-app-border bg-app-elevated/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-app-accent-subtle border border-app-accent/30 text-app-accent flex items-center justify-center">
              <TrelloIcon className="w-5 h-5 text-app-accent" />
            </div>
            <div>
              <h3 id="bulk-approval-title" className="text-base sm:text-lg font-semibold text-[#F5F7F8]">
                Review & Publish Selected
              </h3>
              <p className="text-xs sm:text-[13px] text-app-secondary">
                Verify {tasks.length} task{tasks.length > 1 ? 's' : ''} before syncing to Trello sprint board
              </p>
            </div>
          </div>

          {!isPublishing && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-app-border text-app-secondary hover:text-app-primary hover:bg-app-elevated transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          )}
        </div>

        {/* Trello Destination Info */}
        <div className="p-5 bg-app-surface/60 border-b border-app-border/80">
          <div className="flex items-center justify-between text-xs sm:text-[13px] p-3 rounded-xl border border-app-border bg-app-elevated/50 font-mono">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs uppercase tracking-wider text-app-secondary">
                Destination:
              </span>
              <span className="font-semibold text-app-primary truncate">{boardName}</span>
            </div>
            <div className="flex items-center gap-2 text-app-accent text-xs sm:text-[13px] shrink-0">
              <ArrowRight className="w-3.5 h-3.5" />
              <span>{listName}</span>
            </div>
          </div>
        </div>

        {/* Tasks List */}
        <div className="p-5 max-h-72 overflow-y-auto space-y-3">
          {tasks.map((task, idx) => (
            <div
              key={task.id}
              className={cn(
                'p-3.5 rounded-xl border text-sm transition-colors flex items-start gap-3.5',
                isPublishing && publishingIndex === idx
                  ? 'border-app-accent bg-app-accent-subtle/30 shadow-xs ring-1 ring-app-accent/40'
                  : 'border-app-border/80 bg-app-elevated/20'
              )}
            >
              <div className="mt-0.5 shrink-0">
                {isPublishing && publishingIndex === idx ? (
                  <Loader2 className="w-4.5 h-4.5 text-app-accent animate-spin" />
                ) : (
                  <div className="w-5 h-5 rounded-full border border-app-border bg-app-surface flex items-center justify-center text-xs font-mono text-app-secondary">
                    {idx + 1}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-app-primary text-sm sm:text-[14.5px] leading-snug truncate">
                  {task.title}
                </p>
                <div className="flex items-center gap-3 text-xs sm:text-[12.5px] font-mono text-app-secondary mt-1">
                  <span>Assignee: {task.assignee_name || 'Unassigned'}</span>
                  <span>•</span>
                  <span>Due: {task.due_date ? formatDate(task.due_date) : 'None'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-app-border bg-app-elevated/30 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPublishing}
            className="px-4 py-2 rounded-xl border border-app-border bg-app-surface text-sm text-app-secondary hover:text-app-primary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleStartPublish}
            disabled={isPublishing || tasks.length === 0}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md active:scale-95',
              isPublishing
                ? 'bg-app-elevated text-app-secondary border border-app-border cursor-wait'
                : 'bg-app-accent text-black hover:opacity-95 shadow-[0_0_16px_rgba(190,255,83,0.3)] ring-1 ring-app-accent'
            )}
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Publishing to Trello...</span>
              </>
            ) : (
              <>
                <TrelloIcon className="w-4 h-4" />
                <span>Publish {tasks.length} Task{tasks.length > 1 ? 's' : ''} to Trello</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
