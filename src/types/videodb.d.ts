declare module 'videodb' {
  export interface ConnectionConfig {
    apiKey?: string;
    sessionToken?: string;
    baseUrl?: string;
  }

  export interface CreateCaptureSessionOptions {
    endUserId: string;
    callbackUrl?: string;
    metadata?: Record<string, unknown>;
    wsConnectionId?: string;
  }

  export interface CaptureSession {
    id: string;
    collectionId: string;
    status: string;
    endUserId?: string;
    callbackUrl?: string;
    metadata?: Record<string, unknown>;
  }

  export interface Video {
    id: string;
    collectionId: string;
    name: string;
    streamUrl: string;
    playerUrl: string;
    length: string;
    // Correct methods from SDK
    indexSpokenWords(
      languageCode?: string,
      segmentationType?: string,
      force?: boolean,
      callbackUrl?: string
    ): Promise<{ success: boolean; message?: string }>;
    getTranscript(): Promise<Array<{ start: number; end: number; text: string }>>;
    getTranscriptText(): Promise<string>;
    generateStream(timeline?: Array<[number, number]>): Promise<string>;
    generateThumbnail(time?: number): Promise<string>;
    search(query: string, searchType?: string, indexType?: string): Promise<unknown>;
  }

  export interface Collection {
    id: string;
    createCaptureSession(options: CreateCaptureSessionOptions): Promise<CaptureSession>;
    getVideo(videoId: string): Promise<Video>;
    generateText(
      prompt: string,
      modelName?: 'basic' | 'pro' | 'ultra',
      responseType?: 'text' | 'json'
    ): Promise<string | Record<string, unknown>>;
  }

  export type RTStreamCategory =
    | 'mic'
    | 'mics'
    | 'screen'
    | 'displays'
    | 'system_audio'
    | 'cameras';

  export class RTStream {
    id: string;
    name?: string;
    collectionId?: string;
    status?: string;
    channelId?: string;
    startTranscript(socketId?: string, engine?: string): Promise<Record<string, unknown>>;
    stopTranscript(mode?: 'graceful' | 'force', engine?: string): Promise<Record<string, unknown>>;
    getTranscript(config?: {
      page?: number;
      pageSize?: number;
      start?: number;
      end?: number;
      since?: number;
      engine?: string;
    }): Promise<Record<string, unknown>>;
  }

  export class CaptureSessionFull {
    id: string;
    collectionId: string;
    status?: string;
    endUserId?: string;
    callbackUrl?: string;
    metadata?: Record<string, unknown>;
    rtstreams: RTStream[];
    refresh(): Promise<void>;
    getRTStream(category: RTStreamCategory): RTStream[];
  }

  export class Connection {
    getCollection(id?: string): Promise<Collection>;
    getCollections(): Promise<Collection[]>;
    generateClientToken(expiresIn?: number): Promise<string>;
    createCaptureSession(config: CreateCaptureSessionOptions): Promise<CaptureSession>;
    connectWebsocket(collectionId?: string): Promise<WebSocketConnection>;
    getCaptureSession(sessionId: string, collectionId?: string): Promise<CaptureSessionFull>;
  }

  export function connect(config: ConnectionConfig): Connection;
  export function connect(apiKey?: string, baseURL?: string): Connection;

  // WebSocket types
  export interface WebSocketMessage {
    [key: string]: unknown;
  }

  export interface WebSocketStreamFilter {
    channel?: string;
    id?: string;
  }

  export class WebSocketConnection {
    url: string;
    connectionId?: string;
    connect(): Promise<WebSocketConnection>;
    close(): Promise<void>;
    send(message: WebSocketMessage): Promise<void>;
    onMessage(handler: (message: WebSocketMessage) => void): void;
    onClose(handler: () => void): void;
    onError(handler: (error: Error) => void): void;
    get isConnected(): boolean;
    receive(): AsyncGenerator<WebSocketMessage, void, unknown>;
    stream(filter?: WebSocketStreamFilter): AsyncGenerator<WebSocketMessage, void, unknown>;
  }
}

declare module 'videodb/capture' {
  export interface CaptureClientOptions {
    sessionToken: string;
    apiUrl?: string;
    dev?: boolean;
    restartOnError?: boolean;
  }

  export interface BinaryChannel {
    channelId: string;
    type: 'audio' | 'video';
    name: string;
    isDefault?: boolean;
  }

  export class Channel {
    id: string;
    name: string;
    type: 'audio' | 'video';
    store: boolean;
    pause(): Promise<void>;
    resume(): Promise<void>;
    toDict(): { channel_id: string; type: string; name: string; record: boolean; store: boolean };
  }

  export class AudioChannel extends Channel {}
  export class VideoChannel extends Channel {}

  export class ChannelList<T extends Channel> extends Array<T> {
    get default(): T | undefined;
  }

  export class Channels {
    mics: ChannelList<AudioChannel>;
    displays: ChannelList<VideoChannel>;
    systemAudio: ChannelList<AudioChannel>;
    all(): Channel[];
  }

  export interface RecordingChannelConfig {
    channelId: string;
    type: 'audio' | 'video';
    record?: boolean;
    transcript?: boolean;
    store?: boolean;
    wsConnectionId?: string;
  }

  export interface StartSessionConfig {
    sessionId: string;
    channels: RecordingChannelConfig[];
  }

  export type TrackType = 'mic' | 'system_audio' | 'screen';
  export type PermissionType = 'microphone' | 'screen_capture' | 'accessibility';
  export type PermissionStatus = 'granted' | 'denied' | 'not_determined' | 'restricted';

  export class CaptureClient {
    constructor(options: CaptureClientOptions);
    requestPermission(kind: PermissionType): Promise<PermissionStatus>;
    listChannels(): Promise<Channels>;
    startSession(config: StartSessionConfig): Promise<void>;
    stopSession(): Promise<void>;
    pauseTracks(tracks: TrackType[]): Promise<void>;
    resumeTracks(tracks: TrackType[]): Promise<void>;
    shutdown(): Promise<void>;
    get initialized(): boolean;
    get isCapturing(): boolean;
    on(event: string, callback: (data?: unknown) => void): void;
    emit(event: string, data?: unknown): boolean;
  }

  export class RecorderInstaller {
    static isInstalled(): Promise<boolean>;
    static install(): Promise<void>;
  }

  export class BinaryManager {
    start(options: { sessionToken: string; apiUrl: string }): Promise<void>;
    stop(): Promise<void>;
    sendCommand<T>(command: string, params: Record<string, unknown>): Promise<T>;
    on(event: string, callback: (data?: unknown) => void): void;
  }
}
