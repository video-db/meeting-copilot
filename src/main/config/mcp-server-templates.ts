import type { MCPServerTemplate } from '../../shared/types/mcp.types';

/**
 * Pre-configured MCP Server Templates
 * These templates provide quick setup for common MCP servers
 */
export const mcpServerTemplates: MCPServerTemplate[] = [
  // Documentation & Knowledge
  {
    id: 'notion',
    name: 'Notion',
    description: 'Search and retrieve content from your Notion workspace',
    icon: 'notion',
    transport: 'stdio',
    defaultCommand: 'npx',
    defaultArgs: ['-y', '@notionhq/notion-mcp-server'],
    requiredEnvVars: [
      {
        key: 'NOTION_TOKEN',
        label: 'Notion Integration Token',
        description: 'Your Notion internal integration token',
        placeholder: 'ntn_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        secret: true,
      },
    ],
    docsUrl: 'https://developers.notion.com/docs/getting-started',
    setupInstructions:
      '1. Go to notion.so/my-integrations\n2. Click "New integration" and give it a name\n3. Select the workspace you want to connect\n4. Copy the "Internal Integration Secret" (starts with ntn_)\n5. In Notion, share the pages/databases you want accessible with your integration',
  },

  // CRM Integrations
  {
    id: 'hubspot',
    name: 'HubSpot CRM',
    description: 'Access HubSpot contacts, deals, and company information during calls',
    icon: 'hubspot',
    transport: 'stdio',
    defaultCommand: 'npx',
    defaultArgs: ['-y', '@hubspot/mcp-server'],
    requiredEnvVars: [
      {
        key: 'PRIVATE_APP_ACCESS_TOKEN',
        label: 'Private App Access Token',
        description: 'Your HubSpot private app access token',
        placeholder: 'pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        secret: true,
      },
    ],
    docsUrl: 'https://www.npmjs.com/package/@hubspot/mcp-server',
    setupInstructions:
      '1. Go to HubSpot Settings → Integrations → Private Apps\n2. Click "Create a private app"\n3. Give your app a name and description\n4. Under the "Scopes" tab, add the necessary scopes (contacts, companies, deals, etc.)\n5. Click "Create app" and copy the access token shown',
  },

  // Productivity & Docs
  {
    id: 'coda',
    name: 'Coda',
    description: 'Access Coda docs, tables, and data during calls',
    icon: 'coda',
    transport: 'stdio',
    defaultCommand: 'npx',
    defaultArgs: ['-y', 'coda-mcp@latest'],
    requiredEnvVars: [
      {
        key: 'API_KEY',
        label: 'Coda API Key',
        description: 'Your Coda API key',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        secret: true,
      },
    ],
    docsUrl: 'https://www.npmjs.com/package/coda-mcp',
    setupInstructions:
      '1. Go to coda.io/account and scroll to "API Settings"\n2. Click "Generate API token"\n3. Give your token a name and select the appropriate permissions\n4. Copy the generated API key',
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
    Documentation: mcpServerTemplates.filter((t) =>
      ['notion', 'coda'].includes(t.id)
    ),
    CRM: mcpServerTemplates.filter((t) =>
      ['hubspot'].includes(t.id)
    ),
  };
}
