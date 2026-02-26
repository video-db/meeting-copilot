import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import * as schema from './schema';
import { logger } from '../lib/logger';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqlite: Database.Database | null = null;

export function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'data');

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  return path.join(dbDir, 'meeting-copilot.db');
}

export function initDatabase(): ReturnType<typeof drizzle<typeof schema>> {
  if (db) return db;

  const dbPath = getDbPath();
  logger.info({ dbPath }, 'Initializing database');

  sqlite = new Database(dbPath);
  db = drizzle(sqlite, { schema });

  sqlite.exec(`
    -- Core tables
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      api_key TEXT NOT NULL,
      access_token TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS recordings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT,
      stream_url TEXT,
      player_url TEXT,
      session_id TEXT NOT NULL,
      duration INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'recording' CHECK(status IN ('recording', 'processing', 'available', 'failed')),
      insights TEXT,
      insights_status TEXT NOT NULL DEFAULT 'pending' CHECK(insights_status IN ('pending', 'processing', 'ready', 'failed')),
      call_summary TEXT,
      playbook_snapshot TEXT,
      metrics_snapshot TEXT
    );

    -- Meeting Co-Pilot tables
    CREATE TABLE IF NOT EXISTS transcript_segments (
      id TEXT PRIMARY KEY,
      recording_id INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      channel TEXT NOT NULL CHECK(channel IN ('me', 'them')),
      text TEXT NOT NULL,
      start_time REAL NOT NULL,
      end_time REAL NOT NULL,
      is_final INTEGER NOT NULL DEFAULT 0,
      processed_by_agent INTEGER NOT NULL DEFAULT 0,
      sentiment TEXT CHECK(sentiment IN ('positive', 'neutral', 'negative')),
      triggers TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      recording_id INTEGER NOT NULL,
      segment_id TEXT,
      timestamp REAL NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('important', 'follow_up', 'pricing', 'competitor', 'risk', 'decision', 'action_item')),
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cue_cards (
      id TEXT PRIMARY KEY,
      objection_type TEXT NOT NULL CHECK(objection_type IN ('pricing', 'timing', 'competitor', 'authority', 'security', 'integration', 'not_interested', 'send_info')),
      title TEXT NOT NULL,
      talk_tracks TEXT NOT NULL,
      follow_up_questions TEXT NOT NULL,
      proof_points TEXT,
      avoid_saying TEXT,
      source_doc TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cue_card_triggers (
      id TEXT PRIMARY KEY,
      recording_id INTEGER NOT NULL,
      segment_id TEXT,
      cue_card_id TEXT,
      objection_type TEXT NOT NULL,
      trigger_text TEXT NOT NULL,
      confidence REAL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'pinned', 'dismissed')),
      feedback TEXT CHECK(feedback IN ('helpful', 'wrong', 'irrelevant')),
      timestamp REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playbooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('MEDDIC', 'Challenger', 'SPIN', 'Custom')),
      description TEXT,
      items TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playbook_sessions (
      id TEXT PRIMARY KEY,
      recording_id INTEGER NOT NULL,
      playbook_id TEXT NOT NULL,
      items_coverage TEXT NOT NULL,
      completion_snapshot TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS call_metrics_history (
      id TEXT PRIMARY KEY,
      recording_id INTEGER NOT NULL,
      timestamp REAL NOT NULL,
      talk_ratio_me REAL NOT NULL,
      talk_ratio_them REAL NOT NULL,
      pace_wpm REAL,
      questions_asked INTEGER NOT NULL DEFAULT 0,
      monologue_detected INTEGER NOT NULL DEFAULT 0,
      sentiment_trend TEXT CHECK(sentiment_trend IN ('improving', 'stable', 'declining')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS nudges_history (
      id TEXT PRIMARY KEY,
      recording_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('monologue', 'sentiment', 'talk_ratio', 'next_steps', 'pricing', 'playbook', 'questions', 'pace')),
      message TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high')),
      timestamp REAL NOT NULL,
      dismissed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS copilot_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('prompt', 'config', 'threshold')),
      label TEXT NOT NULL,
      description TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- MCP Tables
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      transport TEXT NOT NULL CHECK(transport IN ('stdio', 'http')),
      command TEXT,
      args TEXT,
      env TEXT,
      url TEXT,
      headers TEXT,
      template_id TEXT,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      auto_connect INTEGER NOT NULL DEFAULT 0,
      connection_status TEXT NOT NULL DEFAULT 'disconnected' CHECK(connection_status IN ('disconnected', 'connecting', 'connected', 'error')),
      last_error TEXT,
      last_connected_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mcp_tool_calls (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      recording_id INTEGER,
      tool_name TEXT NOT NULL,
      tool_input TEXT,
      tool_output TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'success', 'error')),
      error_message TEXT,
      duration_ms INTEGER,
      trigger_type TEXT NOT NULL CHECK(trigger_type IN ('intent', 'manual', 'test')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_users_access_token ON users(access_token);
    CREATE INDEX IF NOT EXISTS idx_recordings_session_id ON recordings(session_id);
    CREATE INDEX IF NOT EXISTS idx_transcript_segments_session ON transcript_segments(session_id);
    CREATE INDEX IF NOT EXISTS idx_transcript_segments_recording ON transcript_segments(recording_id);
    CREATE INDEX IF NOT EXISTS idx_transcript_segments_channel ON transcript_segments(channel);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_recording ON bookmarks(recording_id);
    CREATE INDEX IF NOT EXISTS idx_cue_cards_objection_type ON cue_cards(objection_type);
    CREATE INDEX IF NOT EXISTS idx_cue_card_triggers_recording ON cue_card_triggers(recording_id);
    CREATE INDEX IF NOT EXISTS idx_playbook_sessions_recording ON playbook_sessions(recording_id);
    CREATE INDEX IF NOT EXISTS idx_call_metrics_history_recording ON call_metrics_history(recording_id);
    CREATE INDEX IF NOT EXISTS idx_nudges_history_recording ON nudges_history(recording_id);
    CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_server ON mcp_tool_calls(server_id);
    CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_recording ON mcp_tool_calls(recording_id);
  `);

  ensureRecordingColumns();
  ensureNudgesHistorySchema();

  seedDefaultCueCards();

  seedDefaultPlaybooks();

  seedDefaultSettings();

  logger.info('Database initialized successfully');
  return db;
}

function ensureRecordingColumns(): void {
  if (!sqlite) return;

  const columns = sqlite
    .prepare("PRAGMA table_info('recordings')")
    .all()
    .map((row: any) => row.name);

  const addColumnIfMissing = (name: string, ddl: string) => {
    if (!columns.includes(name)) {
      sqlite!.exec(ddl);
      logger.info({ column: name }, 'Added missing recordings column');
    }
  };

  addColumnIfMissing('call_summary', "ALTER TABLE recordings ADD COLUMN call_summary TEXT");
  addColumnIfMissing('playbook_snapshot', "ALTER TABLE recordings ADD COLUMN playbook_snapshot TEXT");
  addColumnIfMissing('metrics_snapshot', "ALTER TABLE recordings ADD COLUMN metrics_snapshot TEXT");
}

function ensureNudgesHistorySchema(): void {
  if (!sqlite) return;

  const row = sqlite
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='nudges_history'")
    .get() as { sql?: string } | undefined;

  const tableSql = row?.sql || '';
  const hasQuestions = tableSql.includes("'questions'");
  const hasPace = tableSql.includes("'pace'");

  if (hasQuestions && hasPace) {
    return;
  }

  logger.warn(
    { hasQuestions, hasPace },
    'nudges_history table is missing newer enum values; rebuilding table'
  );

  sqlite.exec(`
    ALTER TABLE nudges_history RENAME TO nudges_history_old;

    CREATE TABLE nudges_history (
      id TEXT PRIMARY KEY,
      recording_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('monologue', 'sentiment', 'talk_ratio', 'next_steps', 'pricing', 'playbook', 'questions', 'pace')),
      message TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high')),
      timestamp REAL NOT NULL,
      dismissed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO nudges_history (id, recording_id, type, message, severity, timestamp, dismissed, created_at)
    SELECT id, recording_id, type, message, severity, timestamp, dismissed, created_at
    FROM nudges_history_old;

    DROP TABLE nudges_history_old;
  `);

  logger.info('nudges_history table rebuilt with updated enum values');
}

export function getDatabase(): ReturnType<typeof drizzle<typeof schema>> {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
    logger.info('Database connection closed');
  }
}

export function getUserByAccessToken(accessToken: string) {
  const database = getDatabase();
  return database
    .select()
    .from(schema.users)
    .where(eq(schema.users.accessToken, accessToken))
    .get();
}

export function createUser(data: schema.NewUser) {
  const database = getDatabase();
  return database.insert(schema.users).values(data).returning().get();
}

export function getRecordingById(id: number) {
  const database = getDatabase();
  return database
    .select()
    .from(schema.recordings)
    .where(eq(schema.recordings.id, id))
    .get();
}

export function getRecordingBySessionId(sessionId: string) {
  const database = getDatabase();
  return database
    .select()
    .from(schema.recordings)
    .where(eq(schema.recordings.sessionId, sessionId))
    .get();
}

export function getAllRecordings() {
  const database = getDatabase();
  return database
    .select()
    .from(schema.recordings)
    .orderBy(schema.recordings.createdAt)
    .all();
}

export function createRecording(data: schema.NewRecording) {
  const database = getDatabase();
  return database.insert(schema.recordings).values(data).returning().get();
}

export function updateRecording(id: number, data: Partial<schema.Recording>) {
  const database = getDatabase();
  return database
    .update(schema.recordings)
    .set(data)
    .where(eq(schema.recordings.id, id))
    .returning()
    .get();
}

export function updateRecordingBySessionId(
  sessionId: string,
  data: Partial<schema.Recording>
) {
  const database = getDatabase();
  return database
    .update(schema.recordings)
    .set(data)
    .where(eq(schema.recordings.sessionId, sessionId))
    .returning()
    .get();
}


export function createTranscriptSegment(data: schema.NewTranscriptSegment) {
  const database = getDatabase();
  return database.insert(schema.transcriptSegments).values(data).returning().get();
}

export function getTranscriptSegmentsByRecording(recordingId: number) {
  const database = getDatabase();
  return database
    .select()
    .from(schema.transcriptSegments)
    .where(eq(schema.transcriptSegments.recordingId, recordingId))
    .orderBy(schema.transcriptSegments.startTime)
    .all();
}

export function getTranscriptSegmentsBySession(sessionId: string) {
  const database = getDatabase();
  return database
    .select()
    .from(schema.transcriptSegments)
    .where(eq(schema.transcriptSegments.sessionId, sessionId))
    .orderBy(schema.transcriptSegments.startTime)
    .all();
}

export function getRecentTranscriptSegments(sessionId: string, limit: number = 50) {
  const database = getDatabase();
  return database
    .select()
    .from(schema.transcriptSegments)
    .where(and(
      eq(schema.transcriptSegments.sessionId, sessionId),
      eq(schema.transcriptSegments.isFinal, true)
    ))
    .orderBy(desc(schema.transcriptSegments.startTime))
    .limit(limit)
    .all()
    .reverse();
}

export function updateTranscriptSegment(id: string, data: Partial<schema.TranscriptSegment>) {
  const database = getDatabase();
  return database
    .update(schema.transcriptSegments)
    .set(data)
    .where(eq(schema.transcriptSegments.id, id))
    .returning()
    .get();
}

export function deleteTranscriptSegmentsBySession(sessionId: string) {
  const database = getDatabase();
  return database
    .delete(schema.transcriptSegments)
    .where(eq(schema.transcriptSegments.sessionId, sessionId));
}


export function createBookmark(data: schema.NewBookmark) {
  const database = getDatabase();
  return database.insert(schema.bookmarks).values(data).returning().get();
}

export function getBookmarksByRecording(recordingId: number) {
  const database = getDatabase();
  return database
    .select()
    .from(schema.bookmarks)
    .where(eq(schema.bookmarks.recordingId, recordingId))
    .orderBy(schema.bookmarks.timestamp)
    .all();
}

export function deleteBookmark(id: string) {
  const database = getDatabase();
  return database.delete(schema.bookmarks).where(eq(schema.bookmarks.id, id));
}


export function getCueCardsByType(objectionType: string) {
  const database = getDatabase();
  return database
    .select()
    .from(schema.cueCards)
    .where(eq(schema.cueCards.objectionType, objectionType as any))
    .all();
}

export function getAllCueCards() {
  const database = getDatabase();
  return database.select().from(schema.cueCards).all();
}

export function createCueCard(data: schema.NewCueCard) {
  const database = getDatabase();
  return database.insert(schema.cueCards).values(data).returning().get();
}

export function updateCueCard(id: string, data: Partial<schema.CueCard>) {
  const database = getDatabase();
  return database
    .update(schema.cueCards)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.cueCards.id, id))
    .returning()
    .get();
}


export function createCueCardTrigger(data: schema.NewCueCardTrigger) {
  const database = getDatabase();
  return database.insert(schema.cueCardTriggers).values(data).returning().get();
}

export function getCueCardTriggersByRecording(recordingId: number) {
  const database = getDatabase();
  return database
    .select()
    .from(schema.cueCardTriggers)
    .where(eq(schema.cueCardTriggers.recordingId, recordingId))
    .orderBy(schema.cueCardTriggers.timestamp)
    .all();
}

export function updateCueCardTrigger(id: string, data: Partial<schema.CueCardTrigger>) {
  const database = getDatabase();
  return database
    .update(schema.cueCardTriggers)
    .set(data)
    .where(eq(schema.cueCardTriggers.id, id))
    .returning()
    .get();
}


export function getPlaybookById(id: string) {
  const database = getDatabase();
  return database
    .select()
    .from(schema.playbooks)
    .where(eq(schema.playbooks.id, id))
    .get();
}

export function getAllPlaybooks() {
  const database = getDatabase();
  return database.select().from(schema.playbooks).all();
}

export function getDefaultPlaybook() {
  const database = getDatabase();
  return database
    .select()
    .from(schema.playbooks)
    .where(eq(schema.playbooks.isDefault, true))
    .get();
}

export function createPlaybook(data: schema.NewPlaybook) {
  const database = getDatabase();
  return database.insert(schema.playbooks).values(data).returning().get();
}


export function createPlaybookSession(data: schema.NewPlaybookSession) {
  const database = getDatabase();
  return database.insert(schema.playbookSessions).values(data).returning().get();
}

export function getPlaybookSessionByRecording(recordingId: number) {
  const database = getDatabase();
  return database
    .select()
    .from(schema.playbookSessions)
    .where(eq(schema.playbookSessions.recordingId, recordingId))
    .get();
}

export function updatePlaybookSession(id: string, data: Partial<schema.PlaybookSession>) {
  const database = getDatabase();
  return database
    .update(schema.playbookSessions)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.playbookSessions.id, id))
    .returning()
    .get();
}


export function createCallMetricsSnapshot(data: schema.NewCallMetricsHistory) {
  const database = getDatabase();
  return database.insert(schema.callMetricsHistory).values(data).returning().get();
}

export function getCallMetricsHistory(recordingId: number) {
  const database = getDatabase();
  return database
    .select()
    .from(schema.callMetricsHistory)
    .where(eq(schema.callMetricsHistory.recordingId, recordingId))
    .orderBy(schema.callMetricsHistory.timestamp)
    .all();
}


export function createNudge(data: schema.NewNudgeHistory) {
  const database = getDatabase();
  return database.insert(schema.nudgesHistory).values(data).returning().get();
}

export function getNudgesByRecording(recordingId: number) {
  const database = getDatabase();
  return database
    .select()
    .from(schema.nudgesHistory)
    .where(eq(schema.nudgesHistory.recordingId, recordingId))
    .orderBy(schema.nudgesHistory.timestamp)
    .all();
}

export function dismissNudge(id: string) {
  const database = getDatabase();
  return database
    .update(schema.nudgesHistory)
    .set({ dismissed: true })
    .where(eq(schema.nudgesHistory.id, id))
    .returning()
    .get();
}


export function getSetting(key: string) {
  const database = getDatabase();
  return database
    .select()
    .from(schema.copilotSettings)
    .where(eq(schema.copilotSettings.key, key))
    .get();
}

export function getSettingsByCategory(category: 'prompt' | 'config' | 'threshold') {
  const database = getDatabase();
  return database
    .select()
    .from(schema.copilotSettings)
    .where(eq(schema.copilotSettings.category, category))
    .all();
}

export function getAllSettings() {
  const database = getDatabase();
  return database.select().from(schema.copilotSettings).all();
}

export function upsertSetting(data: schema.NewCopilotSetting) {
  const database = getDatabase();
  const existing = database
    .select()
    .from(schema.copilotSettings)
    .where(eq(schema.copilotSettings.key, data.key))
    .get();

  if (existing) {
    return database
      .update(schema.copilotSettings)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(schema.copilotSettings.key, data.key))
      .returning()
      .get();
  }
  return database.insert(schema.copilotSettings).values(data).returning().get();
}

export function deleteSetting(key: string) {
  const database = getDatabase();
  return database.delete(schema.copilotSettings).where(eq(schema.copilotSettings.key, key));
}


export function deleteCueCard(id: string) {
  const database = getDatabase();
  return database.delete(schema.cueCards).where(eq(schema.cueCards.id, id));
}

export function updatePlaybook(id: string, data: Partial<schema.Playbook>) {
  const database = getDatabase();
  return database
    .update(schema.playbooks)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.playbooks.id, id))
    .returning()
    .get();
}

export function deletePlaybook(id: string) {
  const database = getDatabase();
  return database.delete(schema.playbooks).where(eq(schema.playbooks.id, id));
}

export function setDefaultPlaybook(id: string) {
  const database = getDatabase();
  database.update(schema.playbooks).set({ isDefault: false }).run();
  return database
    .update(schema.playbooks)
    .set({ isDefault: true })
    .where(eq(schema.playbooks.id, id))
    .returning()
    .get();
}


function seedDefaultCueCards() {
  const database = getDatabase();

  const existing = database
    .select()
    .from(schema.cueCards)
    .where(eq(schema.cueCards.isDefault, true))
    .get();

  if (existing) return;

  const defaultCueCards: schema.NewCueCard[] = [
    {
      id: 'cue-pricing-default',
      objectionType: 'pricing',
      title: 'Handling Pricing Objections',
      talkTracks: JSON.stringify([
        "I understand budget is a concern. Let's talk about the ROI you'd see.",
        "What would the cost of NOT solving this problem be?",
        "Many customers initially had the same concern, but found the value exceeded expectations.",
        "Let's break down the investment relative to the results you'd achieve."
      ]),
      followUpQuestions: JSON.stringify([
        "What budget range were you expecting?",
        "How do you typically evaluate ROI on tools like this?",
        "What's the cost of your current approach?"
      ]),
      proofPoints: JSON.stringify([
        "Average customer sees 3x ROI within 6 months",
        "Reduces manual work by 40%"
      ]),
      avoidSaying: JSON.stringify([
        "I can give you a discount",
        "It's not that expensive"
      ]),
      isDefault: true,
    },
    {
      id: 'cue-timing-default',
      objectionType: 'timing',
      title: 'Handling Timing Objections',
      talkTracks: JSON.stringify([
        "I hear that timing is a factor. What would need to change for this to become a priority?",
        "What's happening next quarter that makes it better timing?",
        "Many customers felt the same, but found that starting now gave them a head start.",
        "Let's identify what a pilot might look like to build confidence."
      ]),
      followUpQuestions: JSON.stringify([
        "What other initiatives are competing for attention?",
        "Who else would need to be involved in this decision?",
        "What would make this urgent?"
      ]),
      isDefault: true,
    },
    {
      id: 'cue-competitor-default',
      objectionType: 'competitor',
      title: 'Handling Competitor Mentions',
      talkTracks: JSON.stringify([
        "That's a solid option. What specifically drew you to them?",
        "We often see customers compare us. Here's where we differentiate...",
        "What criteria are most important in your evaluation?",
        "Happy to do a side-by-side comparison on the areas that matter most to you."
      ]),
      followUpQuestions: JSON.stringify([
        "What's working well with your current solution?",
        "What gaps are you hoping to fill?",
        "Are you actively evaluating alternatives?"
      ]),
      isDefault: true,
    },
    {
      id: 'cue-authority-default',
      objectionType: 'authority',
      title: 'Handling Authority Objections',
      talkTracks: JSON.stringify([
        "Totally understand. Who else would be involved in this decision?",
        "What would they need to see to feel confident?",
        "Would it help if I prepared materials for your internal discussion?",
        "Let's make sure we address their concerns proactively."
      ]),
      followUpQuestions: JSON.stringify([
        "What's your typical buying process?",
        "Who signs off on purchases like this?",
        "Would a meeting with all stakeholders be helpful?"
      ]),
      isDefault: true,
    },
    {
      id: 'cue-security-default',
      objectionType: 'security',
      title: 'Handling Security Concerns',
      talkTracks: JSON.stringify([
        "Security is critical. Here's how we approach it...",
        "We're SOC 2 Type II certified and GDPR compliant.",
        "I can connect you with our security team for a detailed review.",
        "What specific security requirements do you have?"
      ]),
      followUpQuestions: JSON.stringify([
        "What compliance frameworks do you need to meet?",
        "Who handles security reviews on your side?",
        "Would you like to see our security documentation?"
      ]),
      isDefault: true,
    },
    {
      id: 'cue-integration-default',
      objectionType: 'integration',
      title: 'Handling Integration Questions',
      talkTracks: JSON.stringify([
        "Great question on integrations. We connect with...",
        "Our API is well-documented and our team can support custom integrations.",
        "What systems would this need to work with?",
        "Let me show you how other customers have integrated."
      ]),
      followUpQuestions: JSON.stringify([
        "What's your current tech stack?",
        "What data would need to flow between systems?",
        "Do you have internal resources for integrations?"
      ]),
      isDefault: true,
    },
  ];

  for (const card of defaultCueCards) {
    database.insert(schema.cueCards).values(card).run();
  }

  logger.info('Seeded default cue cards');
}

function seedDefaultPlaybooks() {
  const database = getDatabase();

  const existing = database
    .select()
    .from(schema.playbooks)
    .where(eq(schema.playbooks.id, 'playbook-meddic'))
    .get();

  if (existing) return;

  const meddicPlaybook: schema.NewPlaybook = {
    id: 'playbook-meddic',
    name: 'MEDDIC Methodology',
    type: 'MEDDIC',
    description: 'A qualification framework focusing on Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, and Champion.',
    items: JSON.stringify([
      {
        id: 'm-metrics',
        label: 'Metrics',
        description: 'Quantify the business impact and ROI',
        keywords: ['ROI', 'cost savings', 'revenue', 'efficiency', 'metrics', 'numbers', 'measure', 'KPI'],
        suggestedQuestions: [
          'What metrics matter most to your team?',
          'How do you measure success today?',
          'What would success look like in numbers?',
          'What\'s the potential impact on revenue/costs?'
        ],
        detectionPrompt: 'Did the conversation discuss quantifiable business metrics, ROI, or measurable outcomes?',
        status: 'missing',
        evidence: []
      },
      {
        id: 'e-economic-buyer',
        label: 'Economic Buyer',
        description: 'Identify who has budget authority',
        keywords: ['budget', 'decision maker', 'approve', 'CFO', 'procurement', 'sign off', 'authority'],
        suggestedQuestions: [
          'Who controls the budget for this initiative?',
          'Who needs to sign off on this purchase?',
          'What\'s your procurement process?',
          'Who else should be involved in this discussion?'
        ],
        detectionPrompt: 'Was the economic buyer or budget authority identified in the conversation?',
        status: 'missing',
        evidence: []
      },
      {
        id: 'd-decision-criteria',
        label: 'Decision Criteria',
        description: 'Understand how they will evaluate solutions',
        keywords: ['criteria', 'requirements', 'must have', 'evaluate', 'compare', 'features', 'needs'],
        suggestedQuestions: [
          'What criteria will you use to make this decision?',
          'What are your must-have requirements?',
          'How will you evaluate different options?',
          'What would make one solution stand out?'
        ],
        detectionPrompt: 'Were the decision criteria or evaluation requirements discussed?',
        status: 'missing',
        evidence: []
      },
      {
        id: 'd-decision-process',
        label: 'Decision Process',
        description: 'Map out the buying process and timeline',
        keywords: ['process', 'timeline', 'steps', 'approval', 'buying', 'next steps', 'when'],
        suggestedQuestions: [
          'What\'s your typical buying process?',
          'What are the steps to get this approved?',
          'What\'s your timeline for making a decision?',
          'Who else needs to be involved?'
        ],
        detectionPrompt: 'Was the decision-making process or timeline discussed?',
        status: 'missing',
        evidence: []
      },
      {
        id: 'i-identify-pain',
        label: 'Identify Pain',
        description: 'Uncover the business problems and challenges',
        keywords: ['problem', 'challenge', 'pain', 'issue', 'struggle', 'difficulty', 'frustration', 'bottleneck'],
        suggestedQuestions: [
          'What challenges are you facing today?',
          'What\'s the impact of this problem on your business?',
          'How long has this been an issue?',
          'What happens if you don\'t solve this?'
        ],
        detectionPrompt: 'Were specific pain points, challenges, or problems discussed?',
        status: 'missing',
        evidence: []
      },
      {
        id: 'c-champion',
        label: 'Champion',
        description: 'Identify an internal advocate',
        keywords: ['champion', 'advocate', 'internal', 'support', 'sponsor', 'push', 'drive'],
        suggestedQuestions: [
          'Who internally would champion this initiative?',
          'Who else is excited about solving this problem?',
          'Who can help drive this forward internally?',
          'Who would benefit most from this solution?'
        ],
        detectionPrompt: 'Was an internal champion or advocate identified?',
        status: 'missing',
        evidence: []
      }
    ]),
    isDefault: true,
  };

  database.insert(schema.playbooks).values(meddicPlaybook).run();

  const challengerPlaybook: schema.NewPlaybook = {
    id: 'playbook-challenger',
    name: 'Challenger Method',
    type: 'Challenger',
    description: 'A methodology focused on teaching, tailoring, and taking control of the conversation.',
    items: JSON.stringify([
      {
        id: 'teach',
        label: 'Teach',
        description: 'Share unique insights and perspectives',
        keywords: ['insight', 'research', 'data', 'trend', 'industry', 'benchmark', 'best practice'],
        suggestedQuestions: [
          'Have you seen the latest research on...?',
          'What trends are you noticing in your industry?',
          'How does your approach compare to industry benchmarks?'
        ],
        detectionPrompt: 'Did you share unique insights or teach the participant something new?',
        status: 'missing',
        evidence: []
      },
      {
        id: 'tailor',
        label: 'Tailor',
        description: 'Customize the message to the participant',
        keywords: ['specific', 'your situation', 'customize', 'relevant', 'for you', 'in your case'],
        suggestedQuestions: [
          'How does this apply to your specific situation?',
          'What\'s unique about your environment?',
          'How would this work in your context?'
        ],
        detectionPrompt: 'Was the conversation tailored to the participant\'s specific situation?',
        status: 'missing',
        evidence: []
      },
      {
        id: 'take-control',
        label: 'Take Control',
        description: 'Guide the conversation and next steps',
        keywords: ['next step', 'recommend', 'suggest', 'should', 'let\'s', 'I propose'],
        suggestedQuestions: [
          'I recommend we...',
          'The next step should be...',
          'Let\'s set up...'
        ],
        detectionPrompt: 'Did you take control by guiding next steps and recommendations?',
        status: 'missing',
        evidence: []
      }
    ]),
    isDefault: false,
  };

  database.insert(schema.playbooks).values(challengerPlaybook).run();

  logger.info('Seeded default playbooks');
}

function seedDefaultSettings() {
  const database = getDatabase();

  const existing = database
    .select()
    .from(schema.copilotSettings)
    .get();

  if (existing) return;

  const defaultSettings: schema.NewCopilotSetting[] = [
    {
      key: 'prompt_sentiment_analysis',
      category: 'prompt',
      label: 'Sentiment Analysis Prompt',
      description: 'Prompt used to analyze participant sentiment when pattern matching is inconclusive',
      value: `Analyze the sentiment of this participant statement in a meeting context.
Return ONLY one word: "positive", "neutral", or "negative"

Statement: "{text}"

Sentiment:`,
    },
    {
      key: 'prompt_objection_detection',
      category: 'prompt',
      label: 'Objection Detection Prompt',
      description: 'Prompt used to detect objections in participant speech',
      value: `Analyze this participant statement from a meeting for objections.

Statement: "{text}"

Identify if this contains an objection. If yes, classify it as one of:
- pricing (cost, budget, expensive)
- timing (not now, later, next quarter)
- competitor (using another solution)
- authority (need approval, decision maker)
- security (data, compliance, privacy)
- integration (technical fit, compatibility)
- not_interested (no need, not a priority)
- send_info (just send materials)

Return JSON: {"hasObjection": boolean, "type": string or null, "confidence": 0-1}`,
    },
    {
      key: 'prompt_summary_bullets',
      category: 'prompt',
      label: 'Summary Bullets Prompt',
      description: 'Prompt used to generate meeting summary bullet points',
      value: `Analyze this meeting transcript and extract 3-5 key summary bullets.
Focus on main discussion points, decisions, and outcomes.

Transcript:
{transcript}

Return JSON array of strings: ["bullet1", "bullet2", ...]`,
    },
    {
      key: 'prompt_pain_points',
      category: 'prompt',
      label: 'Pain Points Extraction Prompt',
      description: 'Prompt used to extract pain points from the meeting',
      value: `Analyze this meeting transcript and identify participant pain points.
Look for problems, challenges, frustrations, and inefficiencies mentioned.

Transcript:
{transcript}

Return JSON array of strings: ["pain1", "pain2", ...]`,
    },
    {
      key: 'prompt_next_steps',
      category: 'prompt',
      label: 'Next Steps Extraction Prompt',
      description: 'Prompt used to extract action items and next steps',
      value: `Analyze this meeting transcript and identify all action items and next steps.
For each, identify who is responsible (me=you, them=other participant, both).

Transcript:
{transcript}

Return JSON array: [{"action": "string", "owner": "me"|"them"|"both", "priority": "high"|"medium"|"low"}]`,
    },
    {
      key: 'threshold_monologue_seconds',
      category: 'threshold',
      label: 'Monologue Alert Threshold',
      description: 'Seconds of continuous talking before triggering a monologue nudge',
      value: '60',
    },
    {
      key: 'threshold_talk_ratio_max',
      category: 'threshold',
      label: 'Max Talk Ratio',
      description: 'Maximum percentage you should be talking (triggers nudge if exceeded)',
      value: '70',
    },
    {
      key: 'threshold_pace_max_wpm',
      category: 'threshold',
      label: 'Max Speaking Pace',
      description: 'Maximum words per minute before pace nudge (typical conversation is 120-150)',
      value: '180',
    },
    {
      key: 'threshold_nudge_cooldown_ms',
      category: 'threshold',
      label: 'Nudge Cooldown',
      description: 'Minimum milliseconds between nudges',
      value: '120000',
    },
    {
      key: 'config_llm_detection',
      category: 'config',
      label: 'Use LLM for Detection',
      description: 'Use AI for objection/sentiment detection (more accurate but slower)',
      value: 'true',
    },
    {
      key: 'config_auto_bookmark_objections',
      category: 'config',
      label: 'Auto-Bookmark Objections',
      description: 'Automatically create bookmarks when objections are detected',
      value: 'true',
    },
  ];

  for (const setting of defaultSettings) {
    database.insert(schema.copilotSettings).values(setting).run();
  }

  logger.info('Seeded default copilot settings');
}

// MCP Server CRUD Operations

export function createMCPServer(data: schema.NewMCPServer) {
  const database = getDatabase();
  return database.insert(schema.mcpServers).values(data).returning().get();
}

export function getMCPServerById(id: string) {
  const database = getDatabase();
  return database
    .select()
    .from(schema.mcpServers)
    .where(eq(schema.mcpServers.id, id))
    .get();
}

export function getAllMCPServers() {
  const database = getDatabase();
  return database
    .select()
    .from(schema.mcpServers)
    .orderBy(schema.mcpServers.createdAt)
    .all();
}

export function getEnabledMCPServers() {
  const database = getDatabase();
  return database
    .select()
    .from(schema.mcpServers)
    .where(eq(schema.mcpServers.isEnabled, true))
    .all();
}

export function getAutoConnectMCPServers() {
  const database = getDatabase();
  return database
    .select()
    .from(schema.mcpServers)
    .where(and(
      eq(schema.mcpServers.isEnabled, true),
      eq(schema.mcpServers.autoConnect, true)
    ))
    .all();
}

export function updateMCPServer(id: string, data: Partial<schema.MCPServer>) {
  const database = getDatabase();
  return database
    .update(schema.mcpServers)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.mcpServers.id, id))
    .returning()
    .get();
}

export function updateMCPServerStatus(
  id: string,
  status: 'disconnected' | 'connecting' | 'connected' | 'error',
  error?: string
) {
  const database = getDatabase();
  const updates: Partial<schema.MCPServer> = {
    connectionStatus: status,
    updatedAt: new Date().toISOString(),
  };

  if (status === 'connected') {
    updates.lastConnectedAt = new Date().toISOString();
    updates.lastError = null;
  } else if (status === 'error' && error) {
    updates.lastError = error;
  }

  return database
    .update(schema.mcpServers)
    .set(updates)
    .where(eq(schema.mcpServers.id, id))
    .returning()
    .get();
}

export function deleteMCPServer(id: string) {
  const database = getDatabase();
  return database.delete(schema.mcpServers).where(eq(schema.mcpServers.id, id));
}

// MCP Tool Call CRUD Operations

export function createMCPToolCall(data: schema.NewMCPToolCall) {
  const database = getDatabase();
  return database.insert(schema.mcpToolCalls).values(data).returning().get();
}

export function getMCPToolCallById(id: string) {
  const database = getDatabase();
  return database
    .select()
    .from(schema.mcpToolCalls)
    .where(eq(schema.mcpToolCalls.id, id))
    .get();
}

export function getMCPToolCallsByServer(serverId: string) {
  const database = getDatabase();
  return database
    .select()
    .from(schema.mcpToolCalls)
    .where(eq(schema.mcpToolCalls.serverId, serverId))
    .orderBy(desc(schema.mcpToolCalls.createdAt))
    .all();
}

export function getMCPToolCallsByRecording(recordingId: number) {
  const database = getDatabase();
  return database
    .select()
    .from(schema.mcpToolCalls)
    .where(eq(schema.mcpToolCalls.recordingId, recordingId))
    .orderBy(schema.mcpToolCalls.createdAt)
    .all();
}

export function updateMCPToolCall(id: string, data: Partial<schema.MCPToolCall>) {
  const database = getDatabase();
  return database
    .update(schema.mcpToolCalls)
    .set(data)
    .where(eq(schema.mcpToolCalls.id, id))
    .returning()
    .get();
}

export { schema };
