export interface Participant {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  role?: string;
  trello_member_id?: string;
}

export interface TranscriptSegment {
  chunk_index: number;
  speaker?: string;
  timestamp?: string;
  text: string;
}

export interface ConfirmedTask {
  id: string;
  meeting_id: string;
  title: string;
  description: string;
  assignee_id: string | null;
  assignee_name?: string;
  owner_member_id?: string | null;
  due_date: string | null;
  confidence: number; // 0.0 to 1.0
  source_quote: string;
  evidence_chunk_index?: number | null;
  transcript_timestamp?: string;
  speaker?: string;
  trello_status: 'not_synced' | 'syncing' | 'synced' | 'failed';
  publication_status?: 'not_published' | 'syncing' | 'created' | 'verified' | 'verification_failed' | 'failed';
  approval_status?: 'pending' | 'approved' | 'rejected';
  trello_card_url?: string;
  trello_card_id?: string;
  verification_error?: string | null;
  evidence_valid?: boolean;
  synced_at?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface ClarificationNeeded {
  id: string;
  meeting_id: string;
  question: string;
  source_quote: string;
  evidence_chunk_index?: number | null;
  reason?: string;
  possible_assignee_ids: string[];
  selected_assignee_id?: string | null;
  selected_due_date?: string | null;
  status: 'pending' | 'resolving' | 'resolved';
  resolved_task_id?: string;
  created_at?: string;
}

export interface SpeculativeIdea {
  id: string;
  meeting_id: string;
  title: string;
  description: string;
  source_quote: string;
  evidence_chunk_index?: number | null;
  timestamp?: string;
  category?: string;
}

export interface Meeting {
  id: string;
  title: string;
  summary: string;
  decisions_summary?: string;
  clarifications_summary?: string;
  brainstorm_summary?: string;
  date: string;
  duration_seconds: number;
  participants: Participant[];
  status: 'recorded' | 'analyzing' | 'reviewed' | 'synced';
  audio_url?: string;
  transcript?: string;
  segments?: TranscriptSegment[];
  confirmed_tasks: ConfirmedTask[];
  clarifications_needed: ClarificationNeeded[];
  speculative_ideas: SpeculativeIdea[];
  audio_hash?: string;
  reused?: boolean;
}

export interface WorkspaceStats {
  confirmed_actions_count: number;
  clarifications_pending_count: number;
  ideas_captured_count: number;
  synced_tasks_count: number;
  total_meetings_count: number;
}

export interface TrelloIntegrationConfig {
  connected: boolean;
  board_id?: string;
  board_name?: string;
  list_id?: string;
  list_name?: string;
  api_key_configured: boolean;
  last_synced_at?: string;
}
