import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod/v4';

const server = new McpServer(
  { name: 'project-check-architect', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.registerTool(
  'architect_ping',
  {
    description: 'Checks that the Project Check Architect MCP server is connected.',
    inputSchema: z.object({}),
  },
  async () => ({
    content: [{ type: 'text', text: 'Project Check Architect MCP is connected.' }],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);

console.error('project-check-architect MCP server running on stdio.');
