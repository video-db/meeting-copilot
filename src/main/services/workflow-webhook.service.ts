/**
 * Workflow Webhook Service
 *
 * Calls configured workflow webhooks after meeting completion.
 * Sends meeting data (video ID, summary, checklist, player URL, etc.) to
 * automation platforms like n8n and Zapier.
 */

import { v4 as uuid } from 'uuid';
import { createChildLogger } from '../lib/logger';
import { getEnabledWorkflows } from '../db';
import type {
  WorkflowWebhookPayload,
  WorkflowWebhookResult,
} from '../../shared/types/workflow.types';

const logger = createChildLogger('workflow-webhook');

const WEBHOOK_TIMEOUT_MS = 30000; // 30 seconds

export interface MeetingCompletionData {
  recordingId: number;
  title: string;
  description?: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  exportedVideoId: string;
  playerUrl: string;
  streamId?: string;
  summary?: string;
  topics?: string[];
  actionItems?: string[];
  checklist?: Array<{ text: string; completed: boolean }>;
  transcript?: Array<{ speaker: 'me' | 'them'; text: string; timestamp: number }>;
}

/**
 * Trigger all enabled workflow webhooks with meeting data
 */
export async function triggerWorkflowWebhooks(
  meetingData: MeetingCompletionData
): Promise<WorkflowWebhookResult[]> {
  const workflows = getEnabledWorkflows();

  if (workflows.length === 0) {
    logger.debug('No enabled workflows to trigger');
    return [];
  }

  logger.info(
    { workflowCount: workflows.length, recordingId: meetingData.recordingId },
    'Triggering workflow webhooks'
  );

  const payload: WorkflowWebhookPayload = {
    callId: uuid(),
    triggeredAt: new Date().toISOString(),
    meeting: {
      recordingId: meetingData.recordingId,
      title: meetingData.title,
      description: meetingData.description,
      startedAt: meetingData.startedAt,
      endedAt: meetingData.endedAt,
      durationSeconds: meetingData.durationSeconds,
    },
    videodb: {
      exportedVideoId: meetingData.exportedVideoId,
      playerUrl: meetingData.playerUrl,
      streamId: meetingData.streamId,
    },
    content: {
      summary: meetingData.summary,
      topics: meetingData.topics,
      actionItems: meetingData.actionItems,
      checklist: meetingData.checklist,
    },
    transcript: meetingData.transcript,
  };

  const results = await Promise.all(
    workflows.map((workflow) => callWebhook(workflow.id, workflow.name, workflow.webhookUrl, payload))
  );

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  logger.info(
    { successCount, failCount, total: workflows.length },
    'Workflow webhooks completed'
  );

  return results;
}

/**
 * Call a single webhook endpoint
 */
async function callWebhook(
  workflowId: string,
  workflowName: string,
  webhookUrl: string,
  payload: WorkflowWebhookPayload
): Promise<WorkflowWebhookResult> {
  const startTime = Date.now();

  try {
    logger.debug({ workflowId, workflowName, url: webhookUrl }, 'Calling webhook');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MeetingCopilot/1.0',
        'X-Workflow-Call-Id': payload.callId,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      logger.warn(
        { workflowId, workflowName, status: response.status, responseTime },
        'Webhook returned non-OK status'
      );
      return {
        workflowId,
        workflowName,
        success: false,
        statusCode: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`,
        responseTime,
      };
    }

    logger.info(
      { workflowId, workflowName, status: response.status, responseTime },
      'Webhook call successful'
    );

    return {
      workflowId,
      workflowName,
      success: true,
      statusCode: response.status,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const err = error as Error;

    if (err.name === 'AbortError') {
      logger.error({ workflowId, workflowName, responseTime }, 'Webhook call timed out');
      return {
        workflowId,
        workflowName,
        success: false,
        error: 'Request timed out',
        responseTime,
      };
    }

    logger.error(
      { workflowId, workflowName, error: err.message, responseTime },
      'Webhook call failed'
    );

    return {
      workflowId,
      workflowName,
      success: false,
      error: err.message,
      responseTime,
    };
  }
}

/**
 * Test a webhook URL by sending a test payload
 */
export async function testWorkflowWebhook(
  webhookUrl: string
): Promise<{ success: boolean; statusCode?: number; error?: string; responseTime?: number }> {
  const testPayload: WorkflowWebhookPayload = {
    callId: uuid(),
    triggeredAt: new Date().toISOString(),
    meeting: {
      recordingId: 0,
      title: 'Test Meeting',
      description: 'This is a test webhook call from Meeting Copilot',
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      durationSeconds: 0,
    },
    videodb: {
      exportedVideoId: 'test-video-id',
      playerUrl: 'https://example.com/player/test',
    },
    content: {
      summary: 'This is a test webhook call to verify your workflow integration.',
      topics: ['Test Topic'],
      actionItems: ['Verify webhook integration'],
      checklist: [{ text: 'Test checklist item', completed: false }],
    },
  };

  const result = await callWebhook('test', 'Test', webhookUrl, testPayload);

  return {
    success: result.success,
    statusCode: result.statusCode,
    error: result.error,
    responseTime: result.responseTime,
  };
}
