import { NextRequest, NextResponse } from 'next/server';
import { MOCK_PARTICIPANTS } from '@/lib/data/mock-meetings';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    const meetingId = (formData.get('meeting_id') as string) || `meeting_${Date.now()}`;

    if (!audioFile) {
      return NextResponse.json(
        { message: 'Missing audio file in multipart/form-data request' },
        { status: 400 }
      );
    }

    const fileSize = audioFile.size;
    const filename = audioFile.name || 'recording.wav';

    // Simulate realistic speech recognition & meeting intelligence extraction
    const estimatedDuration = Math.max(15, Math.round(fileSize / 32000));

    const meetingPayload = {
      meeting_id: meetingId,
      title: `Executive Standup & Commitment Sync (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
      summary: `Processed speech from ${filename} (${Math.round(fileSize / 1024)} KB). The conversation focused on resolving deployment blockers, confirming immediate sprint deliverables, and distinguishing committed owners from open discussion points.`,
      decisions_summary: 'Finalized core API payload standards, confirmed frontend milestone dates, and approved sprint priorities.',
      clarifications_summary: 'Identified 1 ambiguous delegation regarding deployment checklist execution that needs ownership.',
      brainstorm_summary: 'Logged 1 speculative feature regarding automated Slack digest feeds.',
      date: new Date().toISOString(),
      duration_seconds: estimatedDuration,
      status: 'reviewed',
      participants: [
        MOCK_PARTICIPANTS[0],
        MOCK_PARTICIPANTS[1],
        MOCK_PARTICIPANTS[2],
        MOCK_PARTICIPANTS[3],
      ],
      confirmed_tasks: [
        {
          id: `task_${Date.now()}_1`,
          meeting_id: meetingId,
          title: 'Implement 16-bit linear PCM WAV container validation',
          description: 'Ensure recorded microphone input is wrapped into a valid RIFF WAVE header with accurate byte rate and mono downmix.',
          assignee_id: 'user_1',
          assignee_name: 'Aditya Sharma',
          due_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
          confidence: 0.97,
          source_quote: 'Aditya confirmed he will lock down the audio recorder with proper WAV export and zero clipping.',
          transcript_timestamp: '01:12',
          speaker: 'Aditya Sharma',
          trello_status: 'not_synced',
          priority: 'high',
        },
        {
          id: `task_${Date.now()}_2`,
          meeting_id: meetingId,
          title: 'Deploy backend approval webhook to Trello sprint board',
          description: 'Provide an authenticated endpoint that pushes approved meeting action items into the designated Trello list.',
          assignee_id: 'user_2',
          assignee_name: 'Utkarsh Verma',
          due_date: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0],
          confidence: 0.95,
          source_quote: 'Utkarsh will handle the external Trello API push and return the direct card URL.',
          transcript_timestamp: '02:45',
          speaker: 'Utkarsh Verma',
          trello_status: 'not_synced',
          priority: 'high',
        },
        {
          id: `task_${Date.now()}_3`,
          meeting_id: meetingId,
          title: 'Audit dark/light theme tokens for editorial contrast',
          description: 'Verify #0C0E11 dark surface, #15181D cards, and electric lime #C7F36B accents meet accessibility standards.',
          assignee_id: 'user_4',
          assignee_name: 'Priya Patel',
          due_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
          confidence: 0.93,
          source_quote: 'Priya will review the color palette contrast and fine-tune the typography rhythm.',
          transcript_timestamp: '03:30',
          speaker: 'Priya Patel',
          trello_status: 'not_synced',
          priority: 'medium',
        },
      ],
      clarifications_needed: [
        {
          id: `clarification_${Date.now()}_1`,
          meeting_id: meetingId,
          question: 'Who is designated to coordinate the hackathon demo rehearsal and staging environment?',
          source_quote: 'We need someone to verify the staging environment and run through the end-to-end rehearsal before the pitch.',
          reason: 'Mentioned as a mandatory dependency for the final demo, but no single team member committed to lead it.',
          possible_assignee_ids: ['user_1', 'user_2', 'user_3', 'user_4'],
          status: 'pending',
        },
      ],
      speculative_ideas: [
        {
          id: `idea_${Date.now()}_1`,
          meeting_id: meetingId,
          title: 'Automated weekly commitment velocity reports',
          description: 'An executive digest that computes team accountability percentage based on converted vs stalled meeting actions.',
          source_quote: 'Down the line, maybe we could generate a weekly commitment velocity report across all projects.',
          timestamp: '04:18',
          category: 'Analytics',
        },
      ],
    };

    return NextResponse.json({
      success: true,
      processing_time_ms: 1240,
      meeting: meetingPayload,
    });
  } catch (err: any) {
    console.error('API /api/analyze error:', err);
    return NextResponse.json(
      { message: err.message || 'Internal server error during analysis' },
      { status: 500 }
    );
  }
}
