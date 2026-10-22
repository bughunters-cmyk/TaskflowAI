'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Meeting, ConfirmedTask, ClarificationNeeded, WorkspaceStats, TrelloIntegrationConfig } from '@/types/meeting';
import { INITIAL_MEETINGS, getWorkspaceStats, MOCK_PARTICIPANTS } from '@/lib/data/mock-meetings';
import { ziroApi } from '@/lib/api/client';
import confetti from 'canvas-confetti';

export interface Toast {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'error' | 'info';
  cardUrl?: string;
}

interface WorkspaceContextType {
  meetings: Meeting[];
  currentMeeting: Meeting | null;
  currentMeetingId: string;
  stats: WorkspaceStats;
  isDemoMode: boolean;
  trelloConfig: TrelloIntegrationConfig;
  toasts: Toast[];
  isCommandPaletteOpen: boolean;
  activeInspectorTask: ConfirmedTask | null;
  activeInspectorSegment: number | null;
  isInspectorOpen: boolean;
  openInspector: (task: ConfirmedTask, segmentIndex?: number | null) => void;
  closeInspector: () => void;
  selectMeeting: (id: string) => void;
  addMeeting: (meeting: Meeting) => void;
  setDemoMode: (val: boolean) => void;
  setIsCommandPaletteOpen: (val: boolean) => void;
  approveTask: (meetingId: string, taskId: string) => Promise<boolean>;
  approveAllTasks: (meetingId: string) => Promise<void>;
  updateTask: (meetingId: string, taskId: string, updates: Partial<ConfirmedTask>) => void;
  resolveClarification: (meetingId: string, clarificationId: string, assigneeId: string, dueDate?: string) => Promise<boolean>;
  updateTrelloConfig: (config: Partial<TrelloIntegrationConfig>) => void;
  resetToDemoData: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const LOCAL_STORAGE_MEETINGS_KEY = 'ziro_meetings_data_v2';
const LOCAL_STORAGE_DEMO_KEY = 'ziro_demo_mode';
const LOCAL_STORAGE_TRELLO_KEY = 'ziro_trello_config_v2';

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [meetings, setMeetings] = useState<Meeting[]>(INITIAL_MEETINGS);
  const [currentMeetingId, setCurrentMeetingId] = useState<string>('meeting_001');
  const [isDemoMode, setIsDemoModeState] = useState<boolean>(true); // default true for rock-solid hackathon experience
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeInspectorTask, setActiveInspectorTask] = useState<ConfirmedTask | null>(null);
  const [activeInspectorSegment, setActiveInspectorSegment] = useState<number | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  const [trelloConfig, setTrelloConfig] = useState<TrelloIntegrationConfig>({
    connected: true,
    board_id: 'brd_eng_q4',
    board_name: 'Core Engineering Sprint Board',
    list_id: 'lst_committed_actions',
    list_name: 'Committed & Verified',
    api_key_configured: true,
    last_synced_at: '2026-10-20T14:30:00Z',
  });

  // Load persisted state on client mount
  useEffect(() => {
    try {
      const savedMeetings = localStorage.getItem(LOCAL_STORAGE_MEETINGS_KEY);
      if (savedMeetings) {
        const parsed = JSON.parse(savedMeetings);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMeetings(parsed);
          setCurrentMeetingId(parsed[0].id);
        }
      }

      const savedDemo = localStorage.getItem(LOCAL_STORAGE_DEMO_KEY);
      if (savedDemo !== null) {
        setIsDemoModeState(savedDemo === 'true');
      }

      const savedTrello = localStorage.getItem(LOCAL_STORAGE_TRELLO_KEY);
      if (savedTrello) {
        setTrelloConfig(JSON.parse(savedTrello));
      }
    } catch (e) {
      console.warn('LocalStorage hydration error:', e);
    }
  }, []);

  // Save meetings whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_MEETINGS_KEY, JSON.stringify(meetings));
    } catch {}
  }, [meetings]);

  const setDemoMode = (val: boolean) => {
    setIsDemoModeState(val);
    try {
      localStorage.setItem(LOCAL_STORAGE_DEMO_KEY, String(val));
    } catch {}
    addToast({
      title: val ? 'Demo Mode Active' : 'Live API Mode Active',
      message: val
        ? 'Using simulated responses without requiring paid AI API keys.'
        : 'Connecting to live FastAPI backend at ' + (ziroApi.getBaseUrl() || 'local server') + '.',
      type: val ? 'info' : 'success',
    });
  };

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newToast: Toast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const currentMeeting = meetings.find((m) => m.id === currentMeetingId) || meetings[0] || null;
  const stats = getWorkspaceStats(meetings);

  const selectMeeting = (id: string) => {
    setCurrentMeetingId(id);
  };

  const addMeeting = (meeting: Meeting) => {
    setMeetings((prev) => [meeting, ...prev.filter((m) => m.id !== meeting.id)]);
    setCurrentMeetingId(meeting.id);
  };

  const openInspector = (task: ConfirmedTask, segmentIndex?: number | null) => {
    setActiveInspectorTask(task);
    setActiveInspectorSegment(segmentIndex ?? task.evidence_chunk_index ?? null);
    setIsInspectorOpen(true);
  };

  const closeInspector = () => {
    setIsInspectorOpen(false);
    setActiveInspectorTask(null);
    setActiveInspectorSegment(null);
  };

  const updateTask = (meetingId: string, taskId: string, updates: Partial<ConfirmedTask>) => {
    setMeetings((prev) =>
      prev.map((m) => {
        if (m.id !== meetingId && prev.length > 1) return m;
        return {
          ...m,
          confirmed_tasks: m.confirmed_tasks.map((t) => {
            if (t.id !== taskId) return t;
            return { ...t, ...updates };
          }),
        };
      })
    );
  };

  const approveTask = async (meetingId: string, taskId: string): Promise<boolean> => {
    const targetMeeting = meetings.find((m) => m.id === meetingId);
    const targetTask = targetMeeting?.confirmed_tasks.find((t) => t.id === taskId);

    if (!targetTask) return false;

    // Validate required fields before human approval
    if (!targetTask.due_date) {
      addToast({
        title: 'Validation Error',
        message: 'A committed task must have an explicit due date before approval.',
        type: 'error',
      });
      return false;
    }

    // Set local state to in-flight
    updateTask(meetingId, taskId, { trello_status: 'syncing', publication_status: 'syncing' });

    try {
      const result = await ziroApi.approveAndPublishTask(
        meetingId,
        taskId,
        {
          title: targetTask.title,
          description: targetTask.description,
          assignee_id: targetTask.assignee_id,
          assignee_name: targetTask.assignee_name,
          owner_member_id: targetTask.owner_member_id || targetTask.assignee_id,
          due_date: targetTask.due_date,
          source_quote: targetTask.source_quote,
          evidence_chunk_index: targetTask.evidence_chunk_index,
        },
        isDemoMode
      );

      if (result.success) {
        updateTask(meetingId, taskId, {
          trello_status: 'synced',
          publication_status: 'verified',
          approval_status: 'approved',
          trello_card_url: result.trello_card_url,
          trello_card_id: result.trello_card_id,
          synced_at: result.synced_at,
          evidence_valid: true,
        });

        // Trigger celebratory confetti effect
        try {
          confetti({
            particleCount: 45,
            spread: 55,
            origin: { y: 0.75 },
            colors: ['#BEFF53', '#FFFFFF', '#15191E', '#929CA9'],
          });
        } catch {}

        addToast({
          title: 'Published to Trello',
          message: `Card #${result.trello_card_id.slice(-6)} verified on sprint board.`,
          cardUrl: result.trello_card_url,
          type: 'success',
        });

        return true;
      } else {
        updateTask(meetingId, taskId, { trello_status: 'failed', publication_status: 'failed' });
        addToast({
          title: 'Approval Failed',
          message: result.message || 'Trello dispatch was rejected.',
          type: 'error',
        });
        return false;
      }
    } catch (e: any) {
      updateTask(meetingId, taskId, {
        trello_status: 'failed',
        publication_status: 'failed',
        verification_error: e.message || 'Network error',
      });
      addToast({
        title: 'Trello Dispatch Error',
        message: e.message || 'Failed to dispatch card to Trello.',
        type: 'error',
      });
      return false;
    }
  };

  const approveAllTasks = async (meetingId: string) => {
    const targetMeeting = meetings.find((m) => m.id === meetingId);
    if (!targetMeeting) return;

    const unapproved = targetMeeting.confirmed_tasks.filter((t) => t.trello_status !== 'synced');
    if (unapproved.length === 0) return;

    addToast({
      title: 'Batch Publishing Initiated',
      message: `Publishing ${unapproved.length} confirmed commitment${unapproved.length > 1 ? 's' : ''} to Trello...`,
      type: 'info',
    });

    for (const task of unapproved) {
      await approveTask(meetingId, task.id);
    }
  };

  const resolveClarification = async (
    meetingId: string,
    clarificationId: string,
    assigneeId: string,
    dueDate?: string
  ): Promise<boolean> => {
    try {
      const result = await ziroApi.resolveClarification(
        meetingId,
        clarificationId,
        assigneeId,
        dueDate,
        isDemoMode
      );

      if (result.success && result.resolved_task) {
        setMeetings((prev) =>
          prev.map((m) => {
            if (m.id !== meetingId && prev.length > 1) return m;

            // Remove or mark clarification resolved
            const updatedClarifications = m.clarifications_needed.map((c) =>
              c.id === clarificationId
                ? { ...c, status: 'resolved' as const, selected_assignee_id: assigneeId, resolved_task_id: result.resolved_task.id }
                : c
            );

            // Add new task to Confirmed column awaiting human approval!
            const updatedConfirmed = [...m.confirmed_tasks, result.resolved_task];

            return {
              ...m,
              clarifications_needed: updatedClarifications,
              confirmed_tasks: updatedConfirmed,
            };
          })
        );

        addToast({
          title: 'Ambiguity Resolved',
          message: 'Task assigned and moved to Confirmed Tasks for your final approval.',
          type: 'success',
        });

        return true;
      }
      return false;
    } catch (e: any) {
      addToast({
        title: 'Resolution Error',
        message: e.message || 'Failed to resolve clarification.',
        type: 'error',
      });
      return false;
    }
  };

  const updateTrelloConfig = (config: Partial<TrelloIntegrationConfig>) => {
    setTrelloConfig((prev) => {
      const updated = { ...prev, ...config };
      try {
        localStorage.setItem(LOCAL_STORAGE_TRELLO_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetToDemoData = () => {
    setMeetings(INITIAL_MEETINGS);
    setCurrentMeetingId('meeting_001');
    setIsDemoModeState(true);
    try {
      localStorage.setItem(LOCAL_STORAGE_MEETINGS_KEY, JSON.stringify(INITIAL_MEETINGS));
      localStorage.setItem(LOCAL_STORAGE_DEMO_KEY, 'true');
    } catch {}
    addToast({
      title: 'Workspace Reset',
      message: 'Restored initial sample meeting intelligence data.',
      type: 'info',
    });
  };

  return (
    <WorkspaceContext.Provider
      value={{
        meetings,
        currentMeeting,
        currentMeetingId,
        stats,
        isDemoMode,
        trelloConfig,
        toasts,
        isCommandPaletteOpen,
        activeInspectorTask,
        activeInspectorSegment,
        isInspectorOpen,
        openInspector,
        closeInspector,
        selectMeeting,
        addMeeting,
        setDemoMode,
        setIsCommandPaletteOpen,
        approveTask,
        approveAllTasks,
        updateTask,
        resolveClarification,
        updateTrelloConfig,
        resetToDemoData,
        addToast,
        removeToast,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
