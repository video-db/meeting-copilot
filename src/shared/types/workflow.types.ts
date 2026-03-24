/**
 * Workflow Types
 *
 * Types for workflow webhook integrations (n8n, Zapier, etc.)
 */

export interface Workflow {
  id: string;
  name: string;
  webhookUrl: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowRequest {
  name: string;
  webhookUrl: string;
  enabled?: boolean;
}

export interface UpdateWorkflowRequest {
  name?: string;
  webhookUrl?: string;
  enabled?: boolean;
}

/**
 * Payload sent to webhook after meeting completion
 */
export interface WorkflowWebhookPayload {
  /** Unique ID for this webhook call */
  callId: string;

  /** Timestamp when the webhook was triggered */
  triggeredAt: string;

  /** Meeting information */
  meeting: {
    /** Recording ID in the local database */
    recordingId: number;

    /** Meeting title/name */
    title: string;

    /** Meeting description (if provided during setup) */
    description?: string;

    /** When the recording started */
    startedAt: string;

    /** When the recording ended */
    endedAt: string;

    /** Duration in seconds */
    durationSeconds: number;
  };

  /** VideoDB export information */
  videodb: {
    /** Exported video ID from VideoDB */
    exportedVideoId: string;

    /** Player URL to view the recording */
    playerUrl: string;

    /** Stream ID */
    streamId?: string;
  };

  /** AI-generated content */
  content: {
    /** Meeting summary */
    summary?: string;

    /** Key topics discussed */
    topics?: string[];

    /** Action items extracted from the meeting */
    actionItems?: string[];

    /** Post-meeting checklist items */
    checklist?: Array<{
      text: string;
      completed: boolean;
    }>;
  };

  /** Full transcript (if available) */
  transcript?: Array<{
    speaker: 'me' | 'them';
    text: string;
    timestamp: number;
  }>;
}

export interface WorkflowWebhookResult {
  workflowId: string;
  workflowName: string;
  success: boolean;
  statusCode?: number;
  error?: string;
  responseTime?: number;
}
