import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Core Tables (Existing)

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  apiKey: text('api_key').notNull(),
  accessToken: text('access_token').notNull().unique(),
});

export const recordings = sqliteTable('recordings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  videoId: text('video_id'),
  collectionId: text('collection_id'),
  streamUrl: text('stream_url'),
  playerUrl: text('player_url'),
  sessionId: text('session_id').notNull(),
  duration: integer('duration'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  status: text('status', { enum: ['recording', 'processing', 'available', 'failed'] })
    .notNull()
    .default('recording'),
  insights: text('insights'),
  insightsStatus: text('insights_status', { enum: ['pending', 'processing', 'ready', 'failed'] })
    .notNull()
    .default('pending'),
  // Enhanced fields for Meeting Co-Pilot
  shortOverview: text('short_overview'), // Narrative paragraph summary
  keyPoints: text('key_points'), // JSON: KeyPoint[] array
  playbookSnapshot: text('playbook_snapshot'), // JSON: final playbook coverage
  metricsSnapshot: text('metrics_snapshot'), // JSON: final conversation metrics
  // Meeting Setup fields
  meetingName: text('meeting_name'),
  meetingDescription: text('meeting_description'),
  probingQuestions: text('probing_questions'), // JSON: ProbingQuestion[]
  meetingChecklist: text('meeting_checklist'), // JSON: string[] (in-meeting agenda)
  // Post-meeting analysis
  postMeetingChecklist: text('post_meeting_checklist'), // JSON: string[] (action items after meeting)
});

// Meeting Co-Pilot Tables

/**
 * Transcript Segments
 * Stores individual transcript segments with rich metadata for real-time processing
 * Note: WebSocket provides: text, is_final, start (epoch), end (epoch)
 * We infer channel from WebSocket source (mic = 'me', system_audio = 'them')
 */
export const transcriptSegments = sqliteTable('transcript_segments', {
  id: text('id').primaryKey(), // UUID generated on insert
  recordingId: integer('recording_id').notNull(),
  sessionId: text('session_id').notNull(),
  channel: text('channel', { enum: ['me', 'them'] }).notNull(),
  text: text('text').notNull(),
  startTime: real('start_time').notNull(), // seconds from call start
  endTime: real('end_time').notNull(),
  isFinal: integer('is_final', { mode: 'boolean' }).notNull().default(false),
  processedByAgent: integer('processed_by_agent', { mode: 'boolean' }).notNull().default(false),
  sentiment: text('sentiment', { enum: ['positive', 'neutral', 'negative'] }),
  triggers: text('triggers'), // JSON array: ['objection:pricing', 'playbook:pain']
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  sessionIdx: index('idx_transcript_segments_session').on(table.sessionId),
  recordingIdx: index('idx_transcript_segments_recording').on(table.recordingId),
  channelIdx: index('idx_transcript_segments_channel').on(table.channel),
}));

/**
 * Bookmarks
 * User-created markers on important moments during calls
 */
export const bookmarks = sqliteTable('bookmarks', {
  id: text('id').primaryKey(),
  recordingId: integer('recording_id').notNull(),
  segmentId: text('segment_id'),
  timestamp: real('timestamp').notNull(), // seconds from call start
  category: text('category', {
    enum: ['important', 'follow_up', 'pricing', 'competitor', 'risk', 'decision', 'action_item']
  }).notNull(),
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  recordingIdx: index('idx_bookmarks_recording').on(table.recordingId),
}));

/**
 * Smart Cards (formerly Cue Cards)
 * Context-aware prompts with suggested responses
 */
export const cueCards = sqliteTable('cue_cards', {
  id: text('id').primaryKey(),
  objectionType: text('objection_type', {
    enum: [
      // New trigger categories
      'open_question', 'decision_point', 'concern', 'risk', 'commitment', 'follow_up', 'information_request',
      // Legacy objection types
      'pricing', 'timing', 'competitor', 'authority', 'security', 'integration', 'not_interested', 'send_info'
    ]
  }).notNull(),
  title: text('title').notNull(),
  talkTracks: text('talk_tracks').notNull(), // JSON array of strings
  followUpQuestions: text('follow_up_questions').notNull(), // JSON array
  proofPoints: text('proof_points'), // JSON array, optional
  avoidSaying: text('avoid_saying'), // JSON array, optional
  sourceDoc: text('source_doc'), // reference to enablement doc
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  objectionTypeIdx: index('idx_cue_cards_objection_type').on(table.objectionType),
}));

/**
 * Cue Card Triggers
 * Track when cue cards are shown during calls
 */
export const cueCardTriggers = sqliteTable('cue_card_triggers', {
  id: text('id').primaryKey(),
  recordingId: integer('recording_id').notNull(),
  segmentId: text('segment_id'),
  cueCardId: text('cue_card_id'),
  objectionType: text('objection_type').notNull(),
  triggerText: text('trigger_text').notNull(),
  confidence: real('confidence'),
  status: text('status', { enum: ['active', 'pinned', 'dismissed'] }).notNull().default('active'),
  feedback: text('feedback', { enum: ['helpful', 'wrong', 'irrelevant'] }),
  timestamp: real('timestamp').notNull(), // seconds from call start
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  recordingIdx: index('idx_cue_card_triggers_recording').on(table.recordingId),
}));

/**
 * Meeting Templates (Agendas)
 * Pre-defined meeting structures for different meeting types
 */
export const playbooks = sqliteTable('playbooks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['1on1', 'ProjectReview', 'Retrospective', 'Discovery', 'Interview', 'Brainstorm', 'Custom'] }).notNull(),
  description: text('description'),
  items: text('items').notNull(), // JSON array of PlaybookItem
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

/**
 * Playbook Sessions
 * Track playbook coverage per call
 */
export const playbookSessions = sqliteTable('playbook_sessions', {
  id: text('id').primaryKey(),
  recordingId: integer('recording_id').notNull(),
  playbookId: text('playbook_id').notNull(),
  itemsCoverage: text('items_coverage').notNull(), // JSON with coverage status per item
  completionSnapshot: text('completion_snapshot'), // JSON final summary
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  recordingIdx: index('idx_playbook_sessions_recording').on(table.recordingId),
}));

/**
 * Call Metrics History
 * Store periodic snapshots of conversation metrics during call
 */
export const callMetricsHistory = sqliteTable('call_metrics_history', {
  id: text('id').primaryKey(),
  recordingId: integer('recording_id').notNull(),
  timestamp: real('timestamp').notNull(), // seconds from call start
  talkRatioMe: real('talk_ratio_me').notNull(),
  talkRatioThem: real('talk_ratio_them').notNull(),
  paceWpm: real('pace_wpm'),
  questionsAsked: integer('questions_asked').notNull().default(0),
  monologueDetected: integer('monologue_detected', { mode: 'boolean' }).notNull().default(false),
  sentimentTrend: text('sentiment_trend', { enum: ['improving', 'stable', 'declining'] }),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  recordingIdx: index('idx_call_metrics_history_recording').on(table.recordingId),
}));

/**
 * Nudges History
 * Track nudges shown during calls
 */
export const nudgesHistory = sqliteTable('nudges_history', {
  id: text('id').primaryKey(),
  recordingId: integer('recording_id').notNull(),
  type: text('type', {
    enum: ['monologue', 'sentiment', 'talk_ratio', 'next_steps', 'pricing', 'playbook', 'questions', 'pace']
  }).notNull(),
  message: text('message').notNull(),
  severity: text('severity', { enum: ['low', 'medium', 'high'] }).notNull(),
  timestamp: real('timestamp').notNull(),
  dismissed: integer('dismissed', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  recordingIdx: index('idx_nudges_history_recording').on(table.recordingId),
}));

/**
 * Copilot Settings
 * Store customizable prompts and configuration
 */
export const copilotSettings = sqliteTable('copilot_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // JSON string for complex values
  category: text('category', {
    enum: ['prompt', 'config', 'threshold']
  }).notNull(),
  label: text('label').notNull(),
  description: text('description'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// Type Exports

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Recording = typeof recordings.$inferSelect;
export type NewRecording = typeof recordings.$inferInsert;

export type TranscriptSegment = typeof transcriptSegments.$inferSelect;
export type NewTranscriptSegment = typeof transcriptSegments.$inferInsert;

export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;

export type CueCard = typeof cueCards.$inferSelect;
export type NewCueCard = typeof cueCards.$inferInsert;

export type CueCardTrigger = typeof cueCardTriggers.$inferSelect;
export type NewCueCardTrigger = typeof cueCardTriggers.$inferInsert;

export type Playbook = typeof playbooks.$inferSelect;
export type NewPlaybook = typeof playbooks.$inferInsert;

export type PlaybookSession = typeof playbookSessions.$inferSelect;
export type NewPlaybookSession = typeof playbookSessions.$inferInsert;

export type CallMetricsHistory = typeof callMetricsHistory.$inferSelect;
export type NewCallMetricsHistory = typeof callMetricsHistory.$inferInsert;

export type NudgeHistory = typeof nudgesHistory.$inferSelect;
export type NewNudgeHistory = typeof nudgesHistory.$inferInsert;

export type CopilotSetting = typeof copilotSettings.$inferSelect;
export type NewCopilotSetting = typeof copilotSettings.$inferInsert;

// MCP (Model Context Protocol) Tables

/**
 * MCP Servers
 * Configuration for connected MCP servers (CRMs, docs, calendars, search tools)
 */
export const mcpServers = sqliteTable('mcp_servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'), // Optional description for display
  transport: text('transport', { enum: ['stdio', 'http'] }).notNull(),
  command: text('command'),           // For stdio transport
  args: text('args'),                 // JSON array of arguments
  env: text('env'),                   // JSON object, encrypted (environment variables)
  url: text('url'),                   // For HTTP/SSE transport
  headers: text('headers'),           // JSON object, encrypted (HTTP headers)
  templateId: text('template_id'),    // Reference to server template
  isEnabled: integer('is_enabled', { mode: 'boolean' }).default(true),
  autoConnect: integer('auto_connect', { mode: 'boolean' }).default(false),
  connectionStatus: text('connection_status', {
    enum: ['disconnected', 'connecting', 'connected', 'error']
  }).default('disconnected'),
  lastError: text('last_error'),
  lastConnectedAt: text('last_connected_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

/**
 * MCP Tool Calls
 * History of tool invocations during calls
 */
export const mcpToolCalls = sqliteTable('mcp_tool_calls', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull(),
  recordingId: integer('recording_id'),
  toolName: text('tool_name').notNull(),
  toolInput: text('tool_input'),      // JSON input parameters
  toolOutput: text('tool_output'),    // JSON output result
  status: text('status', { enum: ['pending', 'success', 'error'] }).notNull(),
  errorMessage: text('error_message'),
  durationMs: integer('duration_ms'),
  triggerType: text('trigger_type', { enum: ['intent', 'manual', 'test'] }).notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  serverIdx: index('idx_mcp_tool_calls_server').on(table.serverId),
  recordingIdx: index('idx_mcp_tool_calls_recording').on(table.recordingId),
}));

export type MCPServer = typeof mcpServers.$inferSelect;
export type NewMCPServer = typeof mcpServers.$inferInsert;

export type MCPToolCall = typeof mcpToolCalls.$inferSelect;
export type NewMCPToolCall = typeof mcpToolCalls.$inferInsert;

/**
 * MCP OAuth Tokens
 * Stores OAuth tokens for MCP servers that require authentication
 */
export const mcpOauthTokens = sqliteTable('mcp_oauth_tokens', {
  serverId: text('server_id').primaryKey(),
  accessToken: text('access_token').notNull(),     // Encrypted
  refreshToken: text('refresh_token'),              // Encrypted
  tokenType: text('token_type').notNull().default('Bearer'),
  scope: text('scope'),
  expiresAt: text('expires_at'),                   // ISO timestamp
  authServerUrl: text('auth_server_url'),          // OAuth server URL for refresh
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export type MCPOauthToken = typeof mcpOauthTokens.$inferSelect;
export type NewMCPOauthToken = typeof mcpOauthTokens.$inferInsert;

/**
 * Calendar Preferences
 * User preferences for meeting notifications and recording behavior
 */
export const calendarPreferences = sqliteTable('calendar_preferences', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  notifyMinutesBefore: integer('notify_minutes_before').notNull().default(2),
  recordingBehavior: text('recording_behavior', {
    enum: ['always_ask', 'default_record', 'no_notification']
  }).notNull().default('always_ask'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export type CalendarPreferences = typeof calendarPreferences.$inferSelect;
export type NewCalendarPreferences = typeof calendarPreferences.$inferInsert;
export type RecordingBehavior = 'always_ask' | 'default_record' | 'no_notification';

// Workflows Tables

/**
 * Workflows
 * Webhook integrations for post-meeting automation (n8n, Zapier, etc.)
 */
export const workflows = sqliteTable('workflows', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  webhookUrl: text('webhook_url').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;
