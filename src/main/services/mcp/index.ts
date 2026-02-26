/**
 * MCP Services Barrel Export
 *
 * Export all MCP services for external use.
 */

// Core Client
export {
  MCPClientService,
  type MCPClientEvents,
} from './mcp-client.service';

// Connection Registry
export {
  ConnectionRegistryService,
  getConnectionRegistry,
  resetConnectionRegistry,
} from './connection-registry.service';

// Connection Orchestrator
export {
  ConnectionOrchestratorService,
  getConnectionOrchestrator,
  resetConnectionOrchestrator,
} from './connection-orchestrator.service';

// Tool Aggregator
export {
  ToolAggregatorService,
  getToolAggregator,
  resetToolAggregator,
  type NamespacedTool,
  type ToolLookupResult,
} from './tool-aggregator.service';

// Health Monitor
export {
  HealthMonitorService,
  getHealthMonitor,
  resetHealthMonitor,
  type HealthMonitorEvents,
} from './health-monitor.service';

// Intent Detection (will be added in Phase 3)
export {
  IntentDetectorService,
  getIntentDetector,
  resetIntentDetector,
} from './intent-detector.service';

// Result Handler (will be added in Phase 3)
export {
  ResultHandlerService,
  getResultHandler,
  resetResultHandler,
} from './result-handler.service';

// MCP Agent (Agentic tool calling loop)
export {
  MCPAgentService,
  getMCPAgent,
  resetMCPAgent,
  type MCPAgentResult,
} from './mcp-agent.service';
