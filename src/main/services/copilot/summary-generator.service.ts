/**
 * Summary Generator Service
 *
 * Generates post-meeting summaries using three specialized prompts:
 * 1. Short Overview - A narrative paragraph summary (3-5 sentences)
 * 2. Key Points - Structured JSON with topics and attributed points
 * 3. Post-Meeting Checklist - Action items and follow-ups from the conversation
 */

import { logger } from '../../lib/logger';
import { getLLMService } from '../llm.service';
import { getTranscriptSegmentsByRecording } from '../../db';

const log = logger.child({ module: 'summary-generator' });

// Types

export interface KeyPoint {
  topic: string;
  points: string[];
}

export interface PostMeetingSummary {
  shortOverview: string;
  keyPoints: KeyPoint[];
  postMeetingChecklist: string[];
  generatedAt: number;
}

export interface ProbingQA {
  question: string;
  answer: string;
  customAnswer?: string;
}

export interface MeetingContext {
  meetingName?: string;
  meetingDescription?: string;
  probingQuestions?: ProbingQA[];
  checklist?: string[];
}

// System Prompts

const SHORT_OVERVIEW_SYSTEM_PROMPT = `You are an expert meeting summarizer. Given a meeting transcript along
with its name, description, and checklist, produce a short narrative
summary of what happened in the meeting.

Rules:
- Write a single flowing paragraph. No bullet points, no headers,
  no numbered lists.
- The summary should read like a brief written by a sharp colleague
  who sat in on the meeting - it tells you who was there, what the
  meeting was about, and what the main threads of discussion were.
- Mention participants by name and what they contributed, but keep it
  high-level. Do not quote anyone verbatim.
- Do not editorialize or add opinions. Stick to what actually happened.
- Aim for 3-5 sentences. Never exceed 120 words.
- Write in past tense, third person.

Respond ONLY with the summary paragraph - no explanation, no headers,
no preamble.`;

const KEY_POINTS_SYSTEM_PROMPT = `You are an expert meeting summarizer. Given a meeting transcript along
with its name, description, and checklist, produce a detailed breakdown
of the key discussion points from the meeting.

Rules:
- Identify the major topics or themes that were discussed. Group related
  points under a clear, short topic heading.
- Under each topic, write individual points attributed to the person
  who raised them. Use the format: "Name did/said/raised/confirmed..."
- Each point should be one concrete sentence capturing what was said,
  decided, or proposed. No filler, no fluff.
- Stay factual - report what happened, do not add interpretation or
  recommendations.
- Write in past tense, third person.
- Aim for 2-5 topics, with 2-5 points each. Let the actual content of
  the meeting dictate the count - do not pad or compress artificially.
- If the checklist items were addressed in the meeting, naturally weave
  that into the relevant topic. Do not create a separate "checklist
  review" section.

Respond ONLY with the JSON object below - no explanation, no markdown
fences, no preamble.

Output format:
{
  "key_points": [
    {
      "topic": "Topic Name",
      "points": [
        "Person did/said something specific.",
        "Another person confirmed/raised another point."
      ]
    }
  ]
}`;

const POST_MEETING_CHECKLIST_SYSTEM_PROMPT = `You are an expert meeting analyst. Given a meeting transcript, extract
all action items, follow-ups, open questions, and tasks that need to be
handled AFTER the meeting ends.

Rules:
- Extract concrete, actionable items that emerged from the conversation.
- Include: tasks assigned to people, decisions that need follow-up,
  questions that were left unanswered, commitments made, deadlines
  mentioned, and next steps discussed.
- Each item should be a clear, actionable statement. Include the
  responsible person if mentioned.
- Good: "John to send the proposal by Friday"
- Good: "Schedule follow-up meeting with design team"
- Good: "Clarify budget allocation with finance"
- Bad: "Discussed the project" (not actionable)
- Order by priority/urgency if discernible, otherwise by order mentioned.
- Generate between 3-10 items. Only include genuine action items from
  the conversation - do not pad or invent items.
- If no clear action items were discussed, return an empty array.

Respond ONLY with the JSON object below - no explanation, no markdown
fences, no preamble.

Output format:
{
  "checklist": [
    "Action item 1",
    "Action item 2"
  ]
}`;

// Summary Generator Service

export class SummaryGeneratorService {
  constructor() {}

  /**
   * Generate short overview, key points, and post-meeting checklist from full transcript
   */
  async generate(
    recordingId: number,
    context: MeetingContext
  ): Promise<PostMeetingSummary> {
    // Fetch full transcript from database
    const dbSegments = getTranscriptSegmentsByRecording(recordingId);

    if (!dbSegments || dbSegments.length === 0) {
      log.warn({ recordingId }, 'No transcript segments found for recording');
      return this.emptyResults();
    }

    log.info({ recordingId, segmentCount: dbSegments.length }, 'Generating post-meeting summaries');

    const transcript = this.formatTranscript(dbSegments);
    const userPrompt = this.buildUserPrompt(transcript, context);

    // Generate all summaries in parallel
    const [shortOverview, keyPoints, postMeetingChecklist] = await Promise.all([
      this.generateShortOverview(userPrompt),
      this.generateKeyPoints(userPrompt),
      this.generatePostMeetingChecklist(userPrompt),
    ]);

    return {
      shortOverview,
      keyPoints,
      postMeetingChecklist,
      generatedAt: Date.now(),
    };
  }

  /**
   * Generate short overview (narrative paragraph)
   */
  private async generateShortOverview(userPrompt: string): Promise<string> {
    const llm = getLLMService();

    try {
      const response = await llm.complete(userPrompt, SHORT_OVERVIEW_SYSTEM_PROMPT);

      if (response.success && response.content) {
        log.info('Short overview generated successfully');
        return response.content.trim();
      }
    } catch (error) {
      log.error({ error }, 'Short overview generation failed');
    }

    return 'Unable to generate meeting summary.';
  }

  /**
   * Generate key points (structured JSON)
   */
  private async generateKeyPoints(userPrompt: string): Promise<KeyPoint[]> {
    const llm = getLLMService();

    try {
      const response = await llm.complete(userPrompt, KEY_POINTS_SYSTEM_PROMPT);

      if (response.success && response.content) {
        // Parse the JSON response
        const parsed = this.parseKeyPointsResponse(response.content);
        if (parsed) {
          log.info({ topicCount: parsed.length }, 'Key points generated successfully');
          return parsed;
        }
      }
    } catch (error) {
      log.error({ error }, 'Key points generation failed');
    }

    return [];
  }

  /**
   * Generate post-meeting checklist (action items)
   */
  private async generatePostMeetingChecklist(userPrompt: string): Promise<string[]> {
    const llm = getLLMService();

    try {
      const response = await llm.complete(userPrompt, POST_MEETING_CHECKLIST_SYSTEM_PROMPT);

      if (response.success && response.content) {
        const parsed = this.parseChecklistResponse(response.content);
        if (parsed) {
          log.info({ itemCount: parsed.length }, 'Post-meeting checklist generated successfully');
          return parsed;
        }
      }
    } catch (error) {
      log.error({ error }, 'Post-meeting checklist generation failed');
    }

    return [];
  }

  /**
   * Parse key points JSON response
   */
  private parseKeyPointsResponse(content: string): KeyPoint[] | null {
    try {
      // Remove markdown fences if present
      let cleaned = content.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      const parsed = JSON.parse(cleaned);

      // Handle both { key_points: [...] } and direct array
      const keyPoints = parsed.key_points || parsed;

      if (Array.isArray(keyPoints)) {
        return keyPoints.map((kp: { topic: string; points: string[] }) => ({
          topic: kp.topic || 'Discussion',
          points: Array.isArray(kp.points) ? kp.points : [],
        }));
      }
    } catch (error) {
      log.warn({ error, content: content.slice(0, 200) }, 'Failed to parse key points JSON');
    }
    return null;
  }

  /**
   * Parse checklist JSON response
   */
  private parseChecklistResponse(content: string): string[] | null {
    try {
      // Remove markdown fences if present
      let cleaned = content.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      const parsed = JSON.parse(cleaned);

      // Handle both { checklist: [...] } and direct array
      const checklist = parsed.checklist || parsed;

      if (Array.isArray(checklist)) {
        return checklist.filter((item: unknown) => typeof item === 'string' && item.trim().length > 0);
      }
    } catch (error) {
      log.warn({ error, content: content.slice(0, 200) }, 'Failed to parse checklist JSON');
    }
    return null;
  }

  /**
   * Build the user prompt with meeting context
   */
  private buildUserPrompt(transcript: string, context: MeetingContext): string {
    const meetingName = context.meetingName || 'Untitled Meeting';
    const meetingDescription = context.meetingDescription || 'No description provided';

    // Format probing questions and answers
    const probingQA = context.probingQuestions?.length
      ? context.probingQuestions.map((q, i) => {
          const answer = q.customAnswer
            ? `${q.answer} (${q.customAnswer})`
            : q.answer;
          return `Q${i + 1}: ${q.question}\nA${i + 1}: ${answer}`;
        }).join('\n\n')
      : 'No pre-meeting context provided';

    const checklist = context.checklist?.length
      ? context.checklist.map((item, i) => `${i + 1}. ${item}`).join('\n')
      : 'No checklist';

    return `Meeting Name: ${meetingName}
Meeting Description: ${meetingDescription}

Pre-Meeting Context (Q&A):
${probingQA}

Checklist:
${checklist}

Transcript:
${transcript}`;
  }

  /**
   * Format transcript segments for the LLM
   */
  private formatTranscript(segments: { channel: string; text: string; startTime: number }[]): string {
    return segments
      .map(s => {
        const speaker = s.channel === 'me' ? 'You' : 'Them';
        const time = this.formatTime(s.startTime);
        return `[${time}] ${speaker}: ${s.text}`;
      })
      .join('\n');
  }

  /**
   * Format time as MM:SS
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Return empty results
   */
  private emptyResults(): PostMeetingSummary {
    return {
      shortOverview: 'No transcript available to summarize.',
      keyPoints: [],
      postMeetingChecklist: [],
      generatedAt: Date.now(),
    };
  }
}

// Singleton Instance

let instance: SummaryGeneratorService | null = null;

export function getSummaryGenerator(): SummaryGeneratorService {
  if (!instance) {
    instance = new SummaryGeneratorService();
  }
  return instance;
}

export function resetSummaryGenerator(): void {
  instance = null;
}

export default SummaryGeneratorService;
