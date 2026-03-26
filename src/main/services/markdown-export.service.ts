/**
 * Markdown Export Service
 *
 * Exports meeting transcripts, summaries, visual analysis, and metrics to markdown files
 * in a globally accessible folder structure (~/.call_md/) for AI agents and other tools.
 *
 * Directory structure:
 *   ~/.call_md/
 *     ├── index.md (list of all meetings)
 *     └── meetings/
 *         └── 2024/
 *             └── 03/
 *                 └── 24/
 *                     └── <meeting-name>/
 *                         ├── summary.md
 *                         ├── transcript.md
 *                         ├── visual.md
 *                         └── metrics.md
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createChildLogger } from '../lib/logger';
import type { PostMeetingSummary } from './copilot/summary-generator.service';
import type { ConversationMetrics } from './copilot/conversation-metrics.service';

const logger = createChildLogger('markdown-export');

const CALL_MD_DIR = path.join(os.homedir(), '.call_md');
const MEETINGS_DIR = path.join(CALL_MD_DIR, 'meetings');
const INDEX_FILE = path.join(CALL_MD_DIR, 'index.md');

export interface MeetingExportData {
  recordingId: number;
  meetingName: string;
  meetingDescription?: string;
  startedAt: Date;
  duration: number; // seconds
  summary: PostMeetingSummary;
  metrics?: ConversationMetrics;
  transcript: Array<{
    speaker: 'me' | 'them';
    text: string;
    startTime: number;
  }>;
  // VideoDB session info for fetching visual analysis
  sessionId?: string;
  apiKey?: string;
}

interface SceneData {
  id: string;
  start: number;
  end: number;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Ensure the directory structure exists
 */
function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Sanitize a filename by removing/replacing invalid characters
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 100);
}

/**
 * Format duration as human-readable string
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

/**
 * Format timestamp as MM:SS
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Fetch visual analysis from local database
 */
function fetchVisualAnalysisFromDB(recordingId: number): SceneData[] {
  try {
    const { getVisualIndexItemsByRecording } = require('../db');
    const items = getVisualIndexItemsByRecording(recordingId);

    const scenes: SceneData[] = items.map((item: any) => ({
      id: item.id,
      start: item.startTime,
      end: item.endTime,
      description: item.text,
      metadata: {
        rtstreamId: item.rtstreamId,
        rtstreamName: item.rtstreamName,
      },
    }));

    logger.info({ recordingId, sceneCount: scenes.length }, 'Fetched visual analysis from DB');
    return scenes;
  } catch (error) {
    const err = error as Error;
    logger.warn({ error: err.message, recordingId }, 'Failed to fetch visual analysis from DB');
    return [];
  }
}

/**
 * Generate summary.md content
 */
function generateSummaryMarkdown(data: MeetingExportData): string {
  const lines: string[] = [];
  const dateStr = data.startedAt.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = data.startedAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  lines.push(`# ${data.meetingName}`);
  lines.push('');
  lines.push(`**Date:** ${dateStr}`);
  lines.push(`**Time:** ${timeStr}`);
  lines.push(`**Duration:** ${formatDuration(data.duration)}`);
  if (data.meetingDescription) {
    lines.push(`**Description:** ${data.meetingDescription}`);
  }
  lines.push('');
  lines.push('## Overview');
  lines.push('');
  lines.push(data.summary.shortOverview);
  lines.push('');

  if (data.summary.keyPoints && data.summary.keyPoints.length > 0) {
    lines.push('## Key Discussion Points');
    lines.push('');
    for (const kp of data.summary.keyPoints) {
      lines.push(`### ${kp.topic}`);
      lines.push('');
      for (const point of kp.points) {
        lines.push(`- ${point}`);
      }
      lines.push('');
    }
  }

  if (data.summary.postMeetingChecklist && data.summary.postMeetingChecklist.length > 0) {
    lines.push('## Action Items');
    lines.push('');
    for (const item of data.summary.postMeetingChecklist) {
      lines.push(`- [ ] ${item}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Exported on ${new Date().toISOString()}*`);

  return lines.join('\n');
}

/**
 * Generate transcript.md content
 */
function generateTranscriptMarkdown(data: MeetingExportData): string {
  const lines: string[] = [];

  lines.push(`# Transcript: ${data.meetingName}`);
  lines.push('');
  lines.push(`**Date:** ${data.startedAt.toISOString().split('T')[0]}`);
  lines.push(`**Duration:** ${formatDuration(data.duration)}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  if (data.transcript && data.transcript.length > 0) {
    for (const segment of data.transcript) {
      const speaker = segment.speaker === 'me' ? 'You' : 'Them';
      const time = formatTimestamp(segment.startTime);
      lines.push(`**[${time}] ${speaker}:** ${segment.text}`);
      lines.push('');
    }
  } else {
    lines.push('*No transcript available*');
  }

  lines.push('---');
  lines.push(`*Exported on ${new Date().toISOString()}*`);

  return lines.join('\n');
}

/**
 * Generate visual.md content
 */
function generateVisualMarkdown(data: MeetingExportData, scenes: SceneData[]): string {
  const lines: string[] = [];

  lines.push(`# Visual Context: ${data.meetingName}`);
  lines.push('');
  lines.push(`**Date:** ${data.startedAt.toISOString().split('T')[0]}`);
  lines.push(`**Scenes Captured:** ${scenes.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  if (scenes.length > 0) {
    for (const scene of scenes) {
      const startTime = formatTimestamp(scene.start);
      const endTime = formatTimestamp(scene.end);
      lines.push(`### [${startTime} - ${endTime}]`);
      lines.push('');
      if (scene.description) {
        lines.push(scene.description);
      } else {
        lines.push('*No description available*');
      }
      lines.push('');
    }
  } else {
    lines.push('*No visual analysis available*');
  }

  lines.push('---');
  lines.push(`*Exported on ${new Date().toISOString()}*`);

  return lines.join('\n');
}

/**
 * Generate metrics.md content
 */
function generateMetricsMarkdown(data: MeetingExportData): string {
  const lines: string[] = [];

  lines.push(`# Conversation Metrics: ${data.meetingName}`);
  lines.push('');
  lines.push(`**Date:** ${data.startedAt.toISOString().split('T')[0]}`);
  lines.push(`**Duration:** ${formatDuration(data.duration)}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  if (data.metrics) {
    lines.push('## Talk Ratio');
    lines.push('');
    lines.push(`- **You:** ${Math.round(data.metrics.talkRatio.me * 100)}%`);
    lines.push(`- **Them:** ${Math.round(data.metrics.talkRatio.them * 100)}%`);
    lines.push('');

    lines.push('## Speaking Pace');
    lines.push('');
    lines.push(`- **Words per minute:** ${data.metrics.pace}`);
    lines.push('');
  } else {
    lines.push('*No metrics available*');
  }

  lines.push('---');
  lines.push(`*Exported on ${new Date().toISOString()}*`);

  return lines.join('\n');
}

/**
 * Get the folder path for a meeting based on its date
 */
function getMeetingFolderPath(meetingName: string, date: Date): string {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const folderName = sanitizeFilename(meetingName);

  return path.join(MEETINGS_DIR, year, month, day, folderName);
}

/**
 * Parse an index entry from a line
 */
interface IndexEntry {
  date: string;
  name: string;
  path: string;
  duration: string;
}

function parseIndexEntries(): IndexEntry[] {
  if (!fs.existsSync(INDEX_FILE)) {
    return [];
  }

  const content = fs.readFileSync(INDEX_FILE, 'utf-8');
  const entries: IndexEntry[] = [];

  const lines = content.split('\n');
  let inTable = false;

  for (const line of lines) {
    if (line.startsWith('| Date')) {
      inTable = true;
      continue;
    }
    if (line.startsWith('|---')) {
      continue;
    }
    if (inTable && line.startsWith('|')) {
      const parts = line.split('|').map(p => p.trim()).filter(p => p);
      if (parts.length >= 4) {
        const linkMatch = parts[1].match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          entries.push({
            date: parts[0],
            name: linkMatch[1],
            path: linkMatch[2],
            duration: parts[2],
          });
        }
      }
    }
  }

  return entries;
}

/**
 * Update the index file with a new meeting entry
 */
function updateIndex(data: MeetingExportData, relativePath: string): void {
  const entries = parseIndexEntries();

  const dateStr = data.startedAt.toISOString().split('T')[0];
  const newEntry: IndexEntry = {
    date: dateStr,
    name: data.meetingName,
    path: relativePath,
    duration: formatDuration(data.duration),
  };

  const existingIndex = entries.findIndex(e => e.path === relativePath);
  if (existingIndex >= 0) {
    entries[existingIndex] = newEntry;
  } else {
    entries.unshift(newEntry);
  }

  entries.sort((a, b) => b.date.localeCompare(a.date));

  const lines: string[] = [];
  lines.push('# Call.md Meeting Index');
  lines.push('');
  lines.push('A chronological index of all recorded meetings.');
  lines.push('');
  lines.push(`*Last updated: ${new Date().toISOString()}*`);
  lines.push('');
  lines.push('| Date | Meeting | Duration | Path |');
  lines.push('|------|---------|----------|------|');

  for (const entry of entries) {
    lines.push(`| ${entry.date} | [${entry.name}](${entry.path}) | ${entry.duration} | \`${entry.path}\` |`);
  }

  lines.push('');

  fs.writeFileSync(INDEX_FILE, lines.join('\n'), 'utf-8');
  logger.debug({ entryCount: entries.length }, 'Index file updated');
}

/**
 * Export a meeting to markdown files
 */
export async function exportMeetingToMarkdown(data: MeetingExportData): Promise<string> {
  initializeCallMdDir();

  try {
    const folderPath = getMeetingFolderPath(data.meetingName, data.startedAt);
    ensureDirectoryExists(folderPath);

    // Fetch visual analysis from local database
    const scenes: SceneData[] = fetchVisualAnalysisFromDB(data.recordingId);

    // Write all markdown files
    fs.writeFileSync(path.join(folderPath, 'summary.md'), generateSummaryMarkdown(data), 'utf-8');
    fs.writeFileSync(path.join(folderPath, 'transcript.md'), generateTranscriptMarkdown(data), 'utf-8');
    fs.writeFileSync(path.join(folderPath, 'visual.md'), generateVisualMarkdown(data, scenes), 'utf-8');
    fs.writeFileSync(path.join(folderPath, 'metrics.md'), generateMetricsMarkdown(data), 'utf-8');

    logger.info({ folderPath, meetingName: data.meetingName, sceneCount: scenes.length }, 'Meeting exported to markdown');

    const relativePath = path.relative(CALL_MD_DIR, folderPath);
    updateIndex(data, relativePath);

    return folderPath;
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message, meetingName: data.meetingName }, 'Failed to export meeting to markdown');
    throw error;
  }
}

/**
 * Get the .call_md directory path
 */
export function getCallMdDir(): string {
  return CALL_MD_DIR;
}

/**
 * Initialize the .call_md directory structure
 */
export function initializeCallMdDir(): void {
  ensureDirectoryExists(CALL_MD_DIR);
  ensureDirectoryExists(MEETINGS_DIR);

  if (!fs.existsSync(INDEX_FILE)) {
    const initialContent = [
      '# Call.md Meeting Index',
      '',
      'A chronological index of all recorded meetings.',
      '',
      `*Last updated: ${new Date().toISOString()}*`,
      '',
      '| Date | Meeting | Duration | Path |',
      '|------|---------|----------|------|',
      '',
    ].join('\n');

    fs.writeFileSync(INDEX_FILE, initialContent, 'utf-8');
    logger.info({ path: CALL_MD_DIR }, 'Initialized .call_md directory');
  }
}
