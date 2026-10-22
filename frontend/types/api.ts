import { Meeting, ConfirmedTask, ClarificationNeeded } from './meeting';

export interface AnalyzeMeetingResponse {
  success: boolean;
  meeting: Meeting;
  processing_time_ms?: number;
  message?: string;
}

export interface ApproveTaskResponse {
  success: boolean;
  task_id: string;
  trello_status: 'synced' | 'failed';
  trello_card_url: string;
  trello_card_id: string;
  synced_at: string;
  message?: string;
}

export interface ResolveClarificationResponse {
  success: boolean;
  clarification_id: string;
  resolved_task: ConfirmedTask;
  message?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: Record<string, unknown>;
}
