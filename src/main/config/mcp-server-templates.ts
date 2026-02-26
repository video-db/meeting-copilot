import type { MCPServerTemplate } from '../../shared/types/mcp.types';

/**
 * Pre-configured MCP Server Templates
 * These templates provide quick setup for common MCP servers
 */
export const mcpServerTemplates: MCPServerTemplate[] = [
  // CRM Integrations
  {
    id: 'hubspot',
    name: 'HubSpot CRM',
    description: 'Access HubSpot contacts, deals, and company information during calls',
    icon: 'hubspot',
    transport: 'stdio',
    defaultCommand: 'npx',
    defaultArgs: ['-y', '@anthropic/hubspot-mcp-server'],
    requiredEnvVars: [
      {
        key: 'HUBSPOT_ACCESS_TOKEN',
        label: 'HubSpot Access Token',
        description: 'Your HubSpot private app access token',
        placeholder: 'pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        secret: true,
      },
    ],
    docsUrl: 'https://developers.hubspot.com/docs/api/private-apps',
    setupInstructions:
      '1. Go to HubSpot Settings > Integrations > Private Apps\n2. Create a new private app\n3. Grant scopes for contacts, companies, and deals\n4. Copy the access token',
  },
  {
    id: 'salesforce',
    name: 'Salesforce CRM',
    description: 'Query Salesforce contacts, opportunities, and accounts',
    icon: 'salesforce',
    transport: 'stdio',
    defaultCommand: 'npx',
    defaultArgs: ['-y', '@anthropic/salesforce-mcp-server'],
    requiredEnvVars: [
      {
        key: 'SALESFORCE_INSTANCE_URL',
        label: 'Salesforce Instance URL',
        description: 'Your Salesforce instance URL',
        placeholder: 'https://yourcompany.my.salesforce.com',
        secret: false,
      },
      {
        key: 'SALESFORCE_ACCESS_TOKEN',
        label: 'Salesforce Access Token',
        description: 'OAuth access token',
        placeholder: '',
        secret: true,
      },
    ],
    docsUrl: 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/',
  },

  // Documentation & Knowledge
  {
    id: 'notion',
    name: 'Notion',
    description: 'Search and retrieve content from your Notion workspace',
    icon: 'notion',
    transport: 'stdio',
    defaultCommand: 'npx',
    defaultArgs: ['-y', '@anthropic/notion-mcp-server'],
    requiredEnvVars: [
      {
        key: 'NOTION_API_KEY',
        label: 'Notion Integration Token',
        description: 'Your Notion internal integration token',
        placeholder: 'secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        secret: true,
      },
    ],
    docsUrl: 'https://developers.notion.com/docs/getting-started',
    setupInstructions:
      '1. Go to notion.so/my-integrations\n2. Create a new integration\n3. Copy the Internal Integration Token\n4. Share relevant pages with your integration',
  },
  {
    id: 'confluence',
    name: 'Confluence',
    description: 'Access Confluence pages and spaces for product documentation',
    icon: 'confluence',
    transport: 'stdio',
    defaultCommand: 'npx',
    defaultArgs: ['-y', '@anthropic/confluence-mcp-server'],
    requiredEnvVars: [
      {
        key: 'CONFLUENCE_URL',
        label: 'Confluence URL',
        description: 'Your Confluence site URL',
        placeholder: 'https://yourcompany.atlassian.net/wiki',
        secret: false,
      },
      {
        key: 'CONFLUENCE_EMAIL',
        label: 'Email',
        description: 'Your Atlassian account email',
        placeholder: 'you@company.com',
        secret: false,
      },
      {
        key: 'CONFLUENCE_API_TOKEN',
        label: 'API Token',
        description: 'Atlassian API token',
        placeholder: '',
        secret: true,
      },
    ],
    docsUrl: 'https://developer.atlassian.com/cloud/confluence/rest/v1/intro/',
  },

  // Calendar & Scheduling
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Check availability and schedule follow-up meetings',
    icon: 'google-calendar',
    transport: 'stdio',
    defaultCommand: 'npx',
    defaultArgs: ['-y', '@anthropic/google-calendar-mcp-server'],
    requiredEnvVars: [
      {
        key: 'GOOGLE_CREDENTIALS_PATH',
        label: 'Credentials File Path',
        description: 'Path to your Google OAuth credentials JSON file',
        placeholder: '/path/to/credentials.json',
        secret: false,
      },
    ],
    docsUrl: 'https://developers.google.com/calendar/api/quickstart/nodejs',
    setupInstructions:
      '1. Enable the Google Calendar API in Google Cloud Console\n2. Create OAuth 2.0 credentials\n3. Download the credentials JSON file\n4. Set the path to the file',
  },

  // Search & Research
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: 'Search the web for competitor info, news, and research',
    icon: 'brave',
    transport: 'stdio',
    defaultCommand: 'npx',
    defaultArgs: ['-y', '@modelcontextprotocol/server-brave-search'],
    requiredEnvVars: [
      {
        key: 'BRAVE_API_KEY',
        label: 'Brave Search API Key',
        description: 'Your Brave Search API key',
        placeholder: 'BSAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        secret: true,
      },
    ],
    docsUrl: 'https://brave.com/search/api/',
    setupInstructions:
      '1. Go to api.search.brave.com\n2. Sign up for an API key\n3. Copy your API key',
  },

  // Memory & Context
  {
    id: 'memory',
    name: 'Memory Server',
    description: 'Store and retrieve notes, insights, and context across calls',
    icon: 'brain',
    transport: 'stdio',
    defaultCommand: 'npx',
    defaultArgs: ['-y', '@modelcontextprotocol/server-memory'],
    requiredEnvVars: [],
    setupInstructions: 'No configuration required. Memory is stored locally.',
  },

  // File System
  {
    id: 'filesystem',
    name: 'File System',
    description: 'Access local files like presentation decks and documents',
    icon: 'folder',
    transport: 'stdio',
    defaultCommand: 'npx',
    defaultArgs: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/directory'],
    requiredEnvVars: [],
    setupInstructions:
      'Update the args to specify which directories the server should have access to.',
  },

  // Custom Templates
  {
    id: 'custom-stdio',
    name: 'Custom Stdio Server',
    description: 'Configure a custom MCP server using stdio transport',
    icon: 'terminal',
    transport: 'stdio',
    requiredEnvVars: [],
    setupInstructions: 'Enter the command and arguments to start your MCP server.',
  },
  {
    id: 'custom-http',
    name: 'Custom HTTP Server',
    description: 'Connect to an MCP server over HTTP/SSE',
    icon: 'globe',
    transport: 'http',
    requiredEnvVars: [],
    setupInstructions: 'Enter the URL of your MCP server endpoint.',
  },
];

/**
 * Get a template by ID
 */
export function getMCPServerTemplate(id: string): MCPServerTemplate | undefined {
  return mcpServerTemplates.find((t) => t.id === id);
}

/**
 * Get all available templates
 */
export function getAllMCPServerTemplates(): MCPServerTemplate[] {
  return mcpServerTemplates;
}

/**
 * Get templates by category (based on template ID patterns)
 */
export function getMCPServerTemplatesByCategory(): Record<string, MCPServerTemplate[]> {
  return {
    CRM: mcpServerTemplates.filter((t) =>
      ['hubspot', 'salesforce'].includes(t.id)
    ),
    Documentation: mcpServerTemplates.filter((t) =>
      ['notion', 'confluence'].includes(t.id)
    ),
    Calendar: mcpServerTemplates.filter((t) =>
      ['google-calendar'].includes(t.id)
    ),
    Search: mcpServerTemplates.filter((t) =>
      ['brave-search'].includes(t.id)
    ),
    Utilities: mcpServerTemplates.filter((t) =>
      ['memory', 'filesystem'].includes(t.id)
    ),
    Custom: mcpServerTemplates.filter((t) =>
      ['custom-stdio', 'custom-http'].includes(t.id)
    ),
  };
}
