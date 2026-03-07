#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'wix-velo-mcp',
  version: '0.0.0',
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('wix-velo-mcp running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
