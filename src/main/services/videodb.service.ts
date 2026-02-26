// eslint-disable-next-line @typescript-eslint/no-var-requires
const videodb = require('videodb');
const { connect } = videodb;
type Connection = ReturnType<typeof connect>;

import { createChildLogger } from '../lib/logger';

const logger = createChildLogger('videodb-service');

interface CachedConnection {
  connection: Connection;
  apiKey: string;
}

let cachedConnection: CachedConnection | null = null;

export class VideoDBService {
  private apiKey: string;
  private baseUrl?: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private getConnection(): Connection {
    if (cachedConnection && cachedConnection.apiKey === this.apiKey) {
      return cachedConnection.connection;
    }

    logger.info('Creating new VideoDB connection');

    const connection = this.baseUrl
      ? connect({ apiKey: this.apiKey, baseUrl: this.baseUrl })
      : connect({ apiKey: this.apiKey });

    cachedConnection = {
      connection,
      apiKey: this.apiKey,
    };

    return connection;
  }

  async verifyApiKey(): Promise<boolean> {
    try {
      const conn = this.getConnection();
      logger.info('Attempting to verify API key by getting collection...');
      await conn.getCollection();
      logger.info('API key verified successfully');
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error({
        errorMessage,
        errorStack,
        errorType: error?.constructor?.name
      }, 'API key verification failed');
      return false;
    }
  }

  async createSessionToken(
    userId: string = 'default-user',
    expiresIn: number = 86400
  ): Promise<{
    sessionToken: string;
    expiresIn: number;
    expiresAt: number;
  }> {
    const conn = this.getConnection();

    logger.info({ userId, expiresIn }, 'Creating session token');

    // SDK signature: generateClientToken(expiresIn?: number) => Promise<string>
    const sessionToken = await conn.generateClientToken(expiresIn);

    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    return {
      sessionToken,
      expiresIn,
      expiresAt,
    };
  }

  async createCaptureSession(params: {
    endUserId: string;
    callbackUrl?: string;
    metadata?: Record<string, unknown>;
    wsConnectionId?: string;
  }): Promise<{
    sessionId: string;
    collectionId: string;
    endUserId: string;
    status: string;
    callbackUrl: string;
  }> {
    const conn = this.getConnection();

    logger.info({ endUserId: params.endUserId, callbackUrl: params.callbackUrl }, 'Creating capture session');

    const collection = await conn.getCollection();

    const sessionOptions: {
      endUserId: string;
      callbackUrl?: string;
      metadata?: Record<string, unknown>;
    } = {
      endUserId: params.endUserId,
    };

    if (params.callbackUrl) {
      sessionOptions.callbackUrl = params.callbackUrl;
    }

    if (params.metadata) {
      sessionOptions.metadata = params.metadata;
    }

    const session = await collection.createCaptureSession(sessionOptions);

    logger.info({ sessionId: session.id }, 'Capture session created');

    return {
      sessionId: session.id,
      collectionId: collection.id,
      endUserId: params.endUserId,
      status: 'created',
      callbackUrl: params.callbackUrl || '',
    };
  }

  async getVideo(videoId: string) {
    const conn = this.getConnection();
    const collection = await conn.getCollection();
    return collection.getVideo(videoId);
  }

  async indexVideo(videoId: string): Promise<void> {
    logger.info({ videoId }, 'Indexing video for spoken words');
    const video = await this.getVideo(videoId);
    await video.indexSpokenWords();
    logger.info({ videoId }, 'Video indexed successfully');
  }

  async generateInsights(videoId: string, customPrompt?: string): Promise<string | null> {
    logger.info({ videoId }, 'Generating AI insights');
    const conn = this.getConnection();
    const collection = await conn.getCollection();
    const video = await this.getVideo(videoId);

    // Fetch transcript text (like Python version)
    let transcriptText: string | null = null;
    try {
      transcriptText = await video.getTranscriptText();
    } catch (error) {
      logger.warn({ error, videoId }, 'Failed to get transcript');
    }

    // Check if transcript exists (like Python version)
    if (!transcriptText || transcriptText.trim().length === 0) {
      logger.info({ videoId }, 'No transcript available, skipping insight generation');
      return null;
    }

    // Construct the full prompt with transcript (matching Python's format exactly)
    const prompt = customPrompt || `Analyze the following meeting transcript and generate a comprehensive meeting report in markdown format.

**Output Structure:**
## 📋 Meeting Summary
A brief 2-3 sentence executive summary of the meeting.

## 🎯 Key Discussion Points
- Bullet points of the main topics discussed

## 💡 Key Decisions
- Any decisions that were made during the meeting
---

Transcript:
${transcriptText}`;

    const result = await collection.generateText(prompt, 'ultra');

    logger.info({ videoId }, 'Insights generated successfully');

    // Handle both string and object responses (like Python version)
    let generatedText: string;
    if (typeof result === 'string') {
      generatedText = result;
    } else {
      const resultObj = result as Record<string, unknown>;
      generatedText = (resultObj.output as string) ||
                      (resultObj.text as string) ||
                      ((resultObj.data as Record<string, unknown>)?.text as string) || '';
    }

    if (!generatedText) {
      logger.warn({ videoId }, 'Empty response from text generation SDK');
      return null;
    }

    return generatedText.trim();
  }

  static clearCache(): void {
    cachedConnection = null;
    logger.info('VideoDB connection cache cleared');
  }
}

export function createVideoDBService(apiKey: string, baseUrl?: string): VideoDBService {
  return new VideoDBService(apiKey, baseUrl);
}
