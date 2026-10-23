import { NextRequest, NextResponse } from 'next/server';
import { MOCK_PARTICIPANTS } from '@/lib/data/mock-meetings';
import { ConfirmedTask } from '@/types/meeting';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ clarificationId: string }> }
) {
  try {
    const { clarificationId } = await context.params;
    const body = await req.json();
    const assigneeId = body.assignee_id;

    if (!assigneeId) {
      return NextResponse.json(
        { message: 'assignee_id is required to resolve ambiguity' },
        { status: 400 }
      );
    }

    const assignee = MOCK_PARTICIPANTS.find((p) => p.id === assigneeId) || {
      id: assigneeId,
      name: 'Designated Assignee',
      role: 'Team Member',
    };

    const resolvedTask: ConfirmedTask = {
      id: `task_promoted_${clarificationId}`,
      meeting_id: body.meeting_id || 'meeting_001',
      title: 'Resolved Commitment: Hackathon Demo Coordination & Staging Validation',
      description: `Ownership confirmed and assigned to ${assignee.name}. Responsible for end-to-end rehearsal and staging environment readiness.`,
      assignee_id: assignee.id,
      assignee_name: assignee.name,
      due_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      confidence: 1.0,
      source_quote: 'Explicitly resolved and approved through TaskFlow AI Meeting Intelligence Workspace.',
      speaker: assignee.name,
      trello_status: 'not_synced',
      priority: 'high',
    };

    return NextResponse.json({
      success: true,
      clarification_id: clarificationId,
      resolved_task: resolvedTask,
      message: `Clarification resolved. Action item assigned to ${assignee.name} and promoted to Confirmed Tasks.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message || 'Failed to resolve clarification' },
      { status: 500 }
    );
  }
}

export const POST = PATCH;
