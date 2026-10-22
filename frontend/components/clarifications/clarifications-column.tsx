'use client';

import React, { useState } from 'react';
import { ClarificationNeeded } from '@/types/meeting';
import { useWorkspace } from '@/lib/context/workspace-context';
import { MOCK_PARTICIPANTS } from '@/lib/data/mock-meetings';
import {
  HelpCircle,
  UserCheck,
  AlertCircle,
  Loader2,
  Quote,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ClarificationsColumnProps {
  clarifications: ClarificationNeeded[];
  onResolve: (clarificationId: string, assigneeId: string, dueDate?: string) => Promise<boolean>;
}

export function ClarificationsColumn({
  clarifications,
  onResolve,
}: ClarificationsColumnProps) {
  const { openInspector } = useWorkspace();
  const [selectedAssignees, setSelectedAssignees] = useState<Record<string, string>>({});
  const [selectedDueDates, setSelectedDueDates] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pendingItems = clarifications.filter((c) => c.status !== 'resolved');

  const handleSelectAssignee = (clarificationId: string, userId: string) => {
    setSelectedAssignees((prev) => ({ ...prev, [clarificationId]: userId }));
  };

  const handleSelectDueDate = (clarificationId: string, date: string) => {
    setSelectedDueDates((prev) => ({ ...prev, [clarificationId]: date }));
  };

  const handleResolve = async (clarificationId: string) => {
    const assigneeId = selectedAssignees[clarificationId];
    if (!assigneeId || resolvingId) return;

    setResolvingId(clarificationId);
    const dueDate = selectedDueDates[clarificationId];
    try {
      await onResolve(clarificationId, assigneeId, dueDate);
    } finally {
      setResolvingId(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col h-full bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-xs">
      {/* Sticky Column Header */}
      <div className="sticky top-0 z-10 px-5 py-4 border-b border-app-border bg-app-surface/95 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,189,98,0.6)]" />
          <h2 className="text-lg sm:text-[19px] font-semibold text-app-primary">
            Clarifications Needed
          </h2>
          <span className="text-xs sm:text-[12.5px] font-mono px-2.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-500 font-bold">
            {pendingItems.length}
          </span>
        </div>
      </div>

      {/* Clarifications List */}
      <div className="flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto min-h-0">
        {pendingItems.length === 0 ? (
          <div className="py-16 text-center text-sm text-app-secondary px-6 border border-dashed border-app-border rounded-2xl bg-app-surface/60">
            <HelpCircle className="w-9 h-9 text-app-secondary/40 mx-auto mb-3" />
            <p className="font-semibold text-app-primary text-base">All ambiguities resolved</p>
            <p className="text-sm text-app-secondary mt-1.5 max-w-xs mx-auto leading-relaxed">
              There are no outstanding unassigned commitments or open questions in this session.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {pendingItems.map((item, idx) => {
              const isResolving = resolvingId === item.id || item.status === 'resolving';
              const currentSelected = selectedAssignees[item.id] || '';
              const currentDueDate = selectedDueDates[item.id] || '';
              const isExpanded = expandedId === item.id;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -12 }}
                  transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.2) }}
                  whileHover={{ y: -2 }}
                  className="relative p-5 sm:p-6 rounded-2xl border border-amber-500/35 bg-app-surface hover:border-amber-500/60 hover:bg-amber-500/5 transition-all duration-200 shadow-xs space-y-3.5"
                >
                  {/* Top Ambiguity Flag & Controls */}
                  <div className="flex items-center justify-between text-xs sm:text-[12.5px] font-mono font-medium text-amber-500">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-amber-500/35 bg-amber-500/10 uppercase tracking-wider font-semibold">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Ambiguity Identified
                    </span>

                    <button
                      type="button"
                      onClick={() => toggleExpand(item.id)}
                      className="p-1 rounded-lg text-app-secondary hover:text-app-primary hover:bg-app-elevated transition-colors"
                      title={isExpanded ? 'Collapse card' : 'Expand full details'}
                      aria-label={isExpanded ? 'Collapse card' : 'Expand full details'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-amber-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Question & Reason */}
                  <div className="space-y-1.5">
                    <h3
                      onClick={() => toggleExpand(item.id)}
                      className="text-base sm:text-[17px] font-semibold text-app-primary leading-snug cursor-pointer hover:text-amber-400 transition-colors"
                    >
                      {item.question}
                    </h3>
                    {item.reason && (
                      <p
                        className={cn(
                          'text-sm sm:text-[14.5px] text-app-secondary leading-relaxed transition-all',
                          !isExpanded && 'line-clamp-2 sm:line-clamp-3'
                        )}
                      >
                        {item.reason}
                      </p>
                    )}
                  </div>

                  {/* Evidence Drawer Trigger */}
                  {item.source_quote && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          openInspector(
                            {
                              id: item.id,
                              meeting_id: item.meeting_id,
                              title: item.question,
                              description: item.reason || '',
                              assignee_id: null,
                              due_date: null,
                              confidence: 0.8,
                              source_quote: item.source_quote,
                              evidence_chunk_index: item.evidence_chunk_index,
                              trello_status: 'not_synced',
                            },
                            item.evidence_chunk_index
                          )
                        }
                        className="w-full text-left p-2.5 rounded-xl border border-amber-500/25 bg-amber-500/5 hover:border-amber-500/45 hover:bg-amber-500/10 transition-colors group/evidence flex items-start justify-between gap-3"
                        title="View context in full transcript drawer"
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <Quote className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <p
                            className={cn(
                              'text-sm italic text-amber-500/90 leading-relaxed',
                              !isExpanded && 'line-clamp-2'
                            )}
                          >
                            &ldquo;{item.source_quote}&rdquo;
                          </p>
                        </div>
                        <span className="text-sm font-medium text-amber-400 shrink-0 group-hover/evidence:underline whitespace-nowrap pt-0.5">
                          View Evidence ↗
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Assignee & Deadline Resolution Controls */}
                  <div className="pt-3 border-t border-app-border/50 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs sm:text-[13px] font-mono uppercase tracking-wider text-app-secondary flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-app-secondary/80" />
                          Designate Owner
                        </span>
                        <span className="text-amber-500 font-semibold">*Required</span>
                      </label>
                      <Select
                        value={currentSelected}
                        onValueChange={(val) => handleSelectAssignee(item.id, val)}
                      >
                        <SelectTrigger className="h-10 sm:h-10.5 bg-app-elevated border-app-border text-sm rounded-xl">
                          <SelectValue placeholder="Select team member to own task..." />
                        </SelectTrigger>
                        <SelectContent>
                          {MOCK_PARTICIPANTS.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name} ({m.role || 'Contributor'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs sm:text-[13px] font-mono uppercase tracking-wider text-app-secondary flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-app-secondary/80" />
                        Committed Due Date
                      </label>
                      <input
                        type="date"
                        value={currentDueDate}
                        onChange={(e) => handleSelectDueDate(item.id, e.target.value)}
                        className="w-full h-10 sm:h-10.5 bg-app-elevated border border-app-border rounded-xl px-3 py-2 text-sm text-app-primary outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Resolve Action */}
                  <div className="pt-1.5">
                    <button
                      type="button"
                      onClick={() => handleResolve(item.id)}
                      disabled={!currentSelected || isResolving}
                      className={cn(
                        'w-full flex items-center justify-center gap-2.5 h-11 px-4 rounded-xl text-sm font-semibold transition-all duration-200 shadow-xs active:scale-95',
                        !currentSelected || isResolving
                          ? 'bg-app-elevated text-app-secondary/50 cursor-not-allowed border border-app-border'
                          : 'bg-amber-500 text-black hover:opacity-95 shadow-[0_0_14px_rgba(245,189,98,0.3)] ring-1 ring-amber-500'
                      )}
                    >
                      {isResolving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Validating & Moving...</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4" />
                          <span>Resolve & Move to Confirmed</span>
                        </>
                      )}
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
