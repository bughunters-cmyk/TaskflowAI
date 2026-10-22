'use client';

import React, { useState } from 'react';
import { Meeting, ConfirmedTask } from '@/types/meeting';
import { useWorkspace } from '@/lib/context/workspace-context';
import { MeetingHeader } from '@/components/dashboard/meeting-header';
import { MeetingMetricsStrip } from '@/components/dashboard/meeting-metrics-strip';
import { ConfirmedTasksColumn } from '@/components/tasks/confirmed-tasks-column';
import { ClarificationsColumn } from '@/components/clarifications/clarifications-column';
import { SpeculativeIdeasColumn } from '@/components/ideas/speculative-ideas-column';
import { TranscriptInspector } from '@/components/dashboard/transcript-inspector';
import { BulkApprovalModal } from '@/components/dashboard/bulk-approval-modal';
import { CheckCircle2, HelpCircle, Sparkles, Columns3, LayoutList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface MeetingIntelligenceBoardProps {
  meeting: Meeting;
}

export function MeetingIntelligenceBoard({ meeting }: MeetingIntelligenceBoardProps) {
  const {
    approveTask,
    updateTask,
    resolveClarification,
    isInspectorOpen,
    openInspector,
    closeInspector,
    trelloConfig,
    addToast,
  } = useWorkspace();

  const [activeTab, setActiveTab] = useState<'confirmed' | 'clarifications' | 'ideas'>('confirmed');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'columns' | 'tabs'>('columns');
  const [newlyResolvedTaskId, setNewlyResolvedTaskId] = useState<string | null>(null);

  const confirmedCount = meeting.confirmed_tasks.length;
  const pendingClarifications = meeting.clarifications_needed.filter(
    (c) => c.status !== 'resolved'
  ).length;
  const ideasCount = meeting.speculative_ideas.length;

  const unpublishedTasks = meeting.confirmed_tasks.filter(
    (t) => t.trello_status !== 'synced'
  );

  // Toggle selection for an individual task
  const handleToggleSelectTask = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  // Select all or deselect all eligible unpublished tasks
  const handleSelectAllTasks = (select: boolean) => {
    if (select) {
      setSelectedTaskIds(unpublishedTasks.map((t) => t.id));
    } else {
      setSelectedTaskIds([]);
    }
  };

  // Execute sequential bulk publishing of selected tasks
  const handleConfirmBulkPublish = async (tasksToPublish: ConfirmedTask[]) => {
    let successCount = 0;
    for (const task of tasksToPublish) {
      const ok = await approveTask(meeting.id, task.id);
      if (ok) {
        successCount += 1;
      }
    }

    // Clear selections
    setSelectedTaskIds([]);

    addToast({
      title: 'Batch Publishing Completed',
      message: `Successfully published ${successCount} of ${tasksToPublish.length} tasks to Trello.`,
      type: successCount === tasksToPublish.length ? 'success' : 'info',
    });
  };

  // Intercept clarification resolution to highlight newly resolved task in confirmed column
  const handleResolveClarification = async (
    clarificationId: string,
    assigneeId: string,
    dueDate?: string
  ): Promise<boolean> => {
    const success = await resolveClarification(meeting.id, clarificationId, assigneeId, dueDate);
    if (success) {
      // Find the resolved task in the meeting or generate temporary id key
      const expectedTaskId = `res_${clarificationId}`;
      setNewlyResolvedTaskId(expectedTaskId);
      setTimeout(() => setNewlyResolvedTaskId(null), 3000);
    }
    return success;
  };

  // Filter selected tasks objects
  const selectedTasks = meeting.confirmed_tasks.filter(
    (t) => selectedTaskIds.includes(t.id) && t.trello_status !== 'synced'
  );

  const handleToggleTranscript = () => {
    if (isInspectorOpen) {
      closeInspector();
    } else if (meeting.confirmed_tasks.length > 0) {
      openInspector(meeting.confirmed_tasks[0], meeting.confirmed_tasks[0].evidence_chunk_index);
    } else {
      openInspector(
        {
          id: 'browse',
          meeting_id: meeting.id,
          title: meeting.title,
          description: '',
          assignee_id: null,
          due_date: null,
          confidence: 1,
          source_quote: '',
          trello_status: 'not_synced',
        },
        0
      );
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-app-bg text-app-primary relative select-none">
      {/* 1. Meeting Header */}
      <MeetingHeader
        meeting={meeting}
        selectedCount={selectedTasks.length}
        onOpenBulkApproval={() => setIsBulkModalOpen(true)}
        onToggleTranscript={handleToggleTranscript}
        isTranscriptOpen={isInspectorOpen}
      />

      {/* 2. Unified Summary Metrics Strip */}
      <div className="px-5 sm:px-8 pt-4 pb-2">
        <MeetingMetricsStrip
          meeting={meeting}
          onFilterClick={(cat) => {
            setActiveTab(cat);
            if (viewMode === 'columns' && window.innerWidth < 1280) {
              setViewMode('tabs');
            }
          }}
          activeCategory={activeTab}
        />
      </div>

      {/* 3. Responsive Workspace Navigation & View Mode Switcher */}
      <div className="px-5 sm:px-8 py-2 border-b border-app-border bg-app-surface/60 flex items-center justify-between gap-3 overflow-x-auto">
        {/* Category Tabs: always visible on tablet/mobile, or when user selects Tabs mode on desktop */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('confirmed')}
            className={cn(
              'relative flex items-center gap-2 py-2 px-3.5 rounded-xl text-sm font-medium transition-all shrink-0',
              activeTab === 'confirmed'
                ? 'bg-app-elevated text-app-primary font-semibold shadow-xs ring-1 ring-app-accent/30'
                : 'text-app-secondary hover:text-app-primary hover:bg-app-elevated/40'
            )}
          >
            <CheckCircle2 className="w-4 h-4 text-app-accent" />
            <span>Confirmed ({confirmedCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('clarifications')}
            className={cn(
              'relative flex items-center gap-2 py-2 px-3.5 rounded-xl text-sm font-medium transition-all shrink-0',
              activeTab === 'clarifications'
                ? 'bg-app-elevated text-app-primary font-semibold shadow-xs ring-1 ring-amber-500/30'
                : 'text-app-secondary hover:text-app-primary hover:bg-app-elevated/40'
            )}
          >
            <HelpCircle className="w-4 h-4 text-amber-500" />
            <span>Needs Clarity ({pendingClarifications})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ideas')}
            className={cn(
              'relative flex items-center gap-2 py-2 px-3.5 rounded-xl text-sm font-medium transition-all shrink-0',
              activeTab === 'ideas'
                ? 'bg-app-elevated text-app-primary font-semibold shadow-xs ring-1 ring-violet-500/30'
                : 'text-app-secondary hover:text-app-primary hover:bg-app-elevated/40'
            )}
          >
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span>Ideas ({ideasCount})</span>
          </button>
        </div>

        {/* Desktop View Mode Switcher: 3 Columns vs Single Focus Tab */}
        <div className="hidden xl:flex items-center gap-1.5 p-1 rounded-xl border border-app-border bg-app-elevated/40 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('columns')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors',
              viewMode === 'columns'
                ? 'bg-app-surface text-app-primary font-semibold shadow-xs border border-app-border'
                : 'text-app-secondary hover:text-app-primary'
            )}
            title="View all 3 columns simultaneously"
          >
            <Columns3 className="w-3.5 h-3.5" />
            <span>3 Columns</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('tabs')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors',
              viewMode === 'tabs'
                ? 'bg-app-surface text-app-primary font-semibold shadow-xs border border-app-border'
                : 'text-app-secondary hover:text-app-primary'
            )}
            title="Focus on one category with extra card width (ideal for 1366px screens)"
          >
            <LayoutList className="w-3.5 h-3.5" />
            <span>Focused View</span>
          </button>
        </div>
      </div>

      {/* 4. Main Task Workspace */}
      <div className="flex-1 p-5 sm:p-8 min-h-0">
        {/* If in Desktop Columns Mode (xl+ and viewMode === 'columns') */}
        {viewMode === 'columns' ? (
          <div className="hidden xl:grid xl:grid-cols-3 gap-6 h-[calc(100vh-270px)] min-h-[580px]">
            <ConfirmedTasksColumn
              tasks={meeting.confirmed_tasks}
              onApprove={(taskId) => approveTask(meeting.id, taskId)}
              onUpdate={(taskId, updates) => updateTask(meeting.id, taskId, updates)}
              selectedTaskIds={selectedTaskIds}
              onToggleSelectTask={handleToggleSelectTask}
              onSelectAllTasks={handleSelectAllTasks}
              newlyResolvedTaskId={newlyResolvedTaskId}
            />

            <ClarificationsColumn
              clarifications={meeting.clarifications_needed}
              onResolve={handleResolveClarification}
            />

            <SpeculativeIdeasColumn ideas={meeting.speculative_ideas} />
          </div>
        ) : null}

        {/* Tabbed View (active on < xl screens OR when user selects Focused View on desktop) */}
        <div
          className={cn(
            'h-[calc(100vh-270px)] min-h-[500px]',
            viewMode === 'columns' ? 'xl:hidden' : 'max-w-4xl mx-auto'
          )}
        >
          <AnimatePresence mode="wait">
            {activeTab === 'confirmed' && (
              <motion.div
                key="confirmed-tab"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <ConfirmedTasksColumn
                  tasks={meeting.confirmed_tasks}
                  onApprove={(taskId) => approveTask(meeting.id, taskId)}
                  onUpdate={(taskId, updates) => updateTask(meeting.id, taskId, updates)}
                  selectedTaskIds={selectedTaskIds}
                  onToggleSelectTask={handleToggleSelectTask}
                  onSelectAllTasks={handleSelectAllTasks}
                  newlyResolvedTaskId={newlyResolvedTaskId}
                />
              </motion.div>
            )}

            {activeTab === 'clarifications' && (
              <motion.div
                key="clarifications-tab"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <ClarificationsColumn
                  clarifications={meeting.clarifications_needed}
                  onResolve={handleResolveClarification}
                />
              </motion.div>
            )}

            {activeTab === 'ideas' && (
              <motion.div
                key="ideas-tab"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <SpeculativeIdeasColumn ideas={meeting.speculative_ideas} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 5. Slide-out Transcript Evidence Inspector */}
      <TranscriptInspector />

      {/* 6. Contextual Bulk Approval Confirmation Modal */}
      <BulkApprovalModal
        tasks={selectedTasks}
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onConfirm={handleConfirmBulkPublish}
        boardName={trelloConfig.board_name}
        listName={trelloConfig.list_name}
      />
    </div>
  );
}
