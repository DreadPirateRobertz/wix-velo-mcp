#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { getConfig } from './lib/config.js';
import { veloStatus } from './tools/veloStatus.js';
import { veloSync } from './tools/veloSync.js';
import { veloDiff } from './tools/veloDiff.js';
import { veloPreview, veloPreviewStop } from './tools/veloPreview.js';
import { veloPublish } from './tools/veloPublish.js';

const server = new McpServer({
  name: 'wix-velo-mcp',
  version: '0.0.0',
});

const config = getConfig();

// ── velo_status ──────────────────────────────────────────────────────

server.registerTool(
  'velo_status',
  {
    description:
      'Check Wix CLI auth status, production repo state, and current deployed tag.',
    inputSchema: z.object({}),
  },
  async () => {
    const result = await veloStatus(config);
    return { content: [{ type: 'text' as const, text: result }] };
  },
);

// ── velo_sync ────────────────────────────────────────────────────────

server.registerTool(
  'velo_sync',
  {
    description:
      'Sync a tagged release from dev repo to production repo. Only accepts semver tags (e.g. v0.0.0, v1.2.3). Copies src/, tests/, package.json, vitest.config.js.',
    inputSchema: z.object({
      tag: z.string().describe('Release tag to sync (e.g. v0.0.0, v1.2.3)'),
    }),
  },
  async ({ tag }) => {
    const result = await veloSync(config, { tag });
    return { content: [{ type: 'text' as const, text: result }] };
  },
);

// ── velo_diff ────────────────────────────────────────────────────────

server.registerTool(
  'velo_diff',
  {
    description:
      'Show what would change in production repo if synced to a given tag. Defaults to latest tag if omitted.',
    inputSchema: z.object({
      tag: z
        .string()
        .optional()
        .describe('Release tag to diff against (defaults to latest)'),
    }),
  },
  async ({ tag }) => {
    const result = await veloDiff(config, { tag });
    return { content: [{ type: 'text' as const, text: result }] };
  },
);

// ── velo_preview ─────────────────────────────────────────────────────

server.registerTool(
  'velo_preview',
  {
    description:
      'Start wix dev server in production repo and return the preview URL. The dev server runs in the background until stopped.',
    inputSchema: z.object({}),
  },
  async () => {
    const result = await veloPreview(config);
    return { content: [{ type: 'text' as const, text: result }] };
  },
);

server.registerTool(
  'velo_preview_stop',
  {
    description: 'Stop the running wix dev server started by velo_preview.',
    inputSchema: z.object({}),
  },
  async () => {
    const result = await veloPreviewStop();
    return { content: [{ type: 'text' as const, text: result }] };
  },
);

// ── velo_publish ─────────────────────────────────────────────────────

server.registerTool(
  'velo_publish',
  {
    description:
      'Publish production repo to live Wix site. Pre-checks: clean worktree and passing tests. Then runs wix publish.',
    inputSchema: z.object({}),
  },
  async () => {
    const result = await veloPublish(config);
    return { content: [{ type: 'text' as const, text: result }] };
  },
);

// ── Start server ─────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('wix-velo-mcp running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
