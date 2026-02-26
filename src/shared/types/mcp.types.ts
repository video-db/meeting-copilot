/**
 * MCP (Model Context Protocol) Types
 * Shared types for MCP client integration
 */

// Transport types
export type MCPTransport = 'stdio' | 'http';

// Connection status
export type MCPConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Trigger types for tool calls
export type MCPTriggerType = 'intent' | 'manual' | 'test';

// Tool call status
export type MCPToolCallStatus = 'pending' | 'success' | 'error';

/**
 * MCP Server Configuration
 * Used for creating and managing MCP server connections
 */
export interface MCPServerConfig {
  id: string;
  name: string;
  transport: MCPTransport;

  // For stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;

  // For HTTP/SSE transport
  url?: string;
  headers?: Record<string, string>;

  // Metadata
  templateId?: string;
  isEnabled: boolean;
  autoConnect: boolean;

  // Connection state
  connectionStatus: MCPConnectionStatus;
  lastError?: string | null;
  lastConnectedAt?: string | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * MCP Tool Definition
 * Describes a tool available from an MCP server
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: 'object';
    properties?: Record<string, MCPToolInputProperty>;
    required?: string[];
  };
  serverId: string;
  serverName: string;
}

export interface MCPToolInputProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
}

/**
 * MCP Tool Call Request
 */
export interface MCPToolCallRequest {
  serverId: string;
  toolName: string;
  input?: Record<string, unknown>;
  triggerType: MCPTriggerType;
  recordingId?: number;
}

/**
 * MCP Tool Call Result
 */
export interface MCPToolResult {
  id: string;
  serverId: string;
  toolName: string;
  status: MCPToolCallStatus;
  result?: unknown;
  error?: string;
  durationMs?: number;
  timestamp: string;
}

/**
 * Display configuration for MCP results
 */
export type MCPDisplayType = 'cue-card' | 'panel' | 'modal' | 'toast';

/**
 * MCP Display Result
 * Transformed tool result for UI rendering
 */
export interface MCPDisplayResult {
  id: string;
  toolCallId: string;
  serverId: string;
  serverName: string;
  toolName: string;
  displayType: MCPDisplayType;
  title: string;
  content: MCPDisplayContent;
  timestamp: string;
  dismissed?: boolean;
  pinned?: boolean;
}

export interface MCPDisplayContent {
  // For text content
  text?: string;
  markdown?: string;

  // For structured data
  items?: Array<{
    label: string;
    value: string;
    type?: 'text' | 'link' | 'badge';
  }>;

  // For tabular data
  table?: {
    headers: string[];
    rows: string[][];
  };

  // For key-value pairs
  properties?: Record<string, string | number | boolean>;

  // Raw data fallback
  raw?: unknown;
}

/**
 * MCP Server Template
 * Pre-configured templates for common MCP servers
 */
export interface MCPServerTemplate {
  id: string;
  name: string;
  description: string;
  icon?: string;
  transport: MCPTransport;

  // Default configuration
  defaultCommand?: string;
  defaultArgs?: string[];
  defaultUrl?: string;

  // Required credentials
  requiredEnvVars?: Array<{
    key: string;
    label: string;
    description?: string;
    placeholder?: string;
    secret?: boolean;
  }>;

  requiredHeaders?: Array<{
    key: string;
    label: string;
    description?: string;
    placeholder?: string;
    secret?: boolean;
  }>;

  // Documentation
  docsUrl?: string;
  setupInstructions?: string;
}

/**
 * Intent detection result
 * When transcript analysis suggests a tool should be called
 */
export interface MCPIntentDetection {
  detected: boolean;
  toolName?: string;
  serverId?: string;
  confidence: number;
  reason?: string;
  suggestedInput?: Record<string, unknown>;
  triggerText?: string;
}

/**
 * MCP Event types for EventEmitter
 */
export interface MCPEvents {
  'server-connected': { serverId: string; tools: MCPTool[] };
  'server-disconnected': { serverId: string; reason: string };
  'server-error': { serverId: string; error: string };
  'tool-call-started': { callId: string; serverId: string; toolName: string };
  'tool-call-completed': MCPToolResult;
  'tool-call-error': { callId: string; serverId: string; toolName: string; error: string };
  'intent-detected': MCPIntentDetection;
}

/**
 * MCP Store State (for Zustand)
 */
export interface MCPState {
  // Server management
  servers: MCPServerConfig[];
  templates: MCPServerTemplate[];

  // Connection state
  connectionStates: Record<string, MCPConnectionStatus>;

  // Available tools (aggregated from all connected servers)
  availableTools: MCPTool[];

  // Active results to display
  activeResults: MCPDisplayResult[];

  // Pending tool calls
  pendingCalls: Set<string>;

  // Configuration
  isInitialized: boolean;
  autoTriggerEnabled: boolean;

  // Error state
  lastError?: string;
}

/**
 * Create server request payload
 */
export interface CreateMCPServerRequest {
  name: string;
  transport: MCPTransport;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  templateId?: string;
  isEnabled?: boolean;
  autoConnect?: boolean;
}

/**
 * Update server request payload
 */
export interface UpdateMCPServerRequest {
  name?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  isEnabled?: boolean;
  autoConnect?: boolean;
}

/**
 * Test connection result
 */
export interface MCPTestConnectionResult {
  success: boolean;
  serverId: string;
  tools?: MCPTool[];
  error?: string;
  latencyMs?: number;
}
