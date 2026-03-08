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
import { veloCatalogImport } from './tools/veloCatalogImport.js';
import { veloSecretsSet } from './tools/veloSecretsSet.js';
import {
  listEmailTemplates,
  createEmailTemplate,
} from './tools/veloEmailTemplate.js';
import { listRedirects, setRedirect } from './tools/veloRedirect.js';
import { veloPageList } from './tools/veloPageList.js';
import { veloCmsCreate } from './tools/veloCmsCreate.js';
import { veloCmsRead } from './tools/veloCmsRead.js';
import { veloCmsUpdate } from './tools/veloCmsUpdate.js';
import { veloDataItemQuery } from './tools/veloDataItemQuery.js';
import { veloDataItemList } from './tools/veloDataItemList.js';
import { veloDataItemInsert } from './tools/veloDataItemInsert.js';
import { veloDataItemUpdate } from './tools/veloDataItemUpdate.js';

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

// ── velo_catalog_import ──────────────────────────────────────────────

server.registerTool(
  'velo_catalog_import',
  {
    description:
      'Import products from catalog-MASTER.json to Wix Stores via REST API. Requires WIX_API_KEY and WIX_SITE_ID env vars.',
    inputSchema: z.object({
      catalogPath: z
        .string()
        .describe('Absolute path to catalog-MASTER.json file'),
      dryRun: z
        .boolean()
        .optional()
        .describe('If true, list products without calling API (default: false)'),
      category: z
        .string()
        .optional()
        .describe('Filter to a specific category slug (e.g. "futon-frames")'),
    }),
  },
  async ({ catalogPath, dryRun, category }) => {
    const wixApiKey = (process.env.WIX_API_KEY || '').trim();
    const wixSiteId = (process.env.WIX_SITE_ID || '').trim();

    if (!dryRun && !wixApiKey) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'ERROR: WIX_API_KEY environment variable is required for catalog import',
          },
        ],
      };
    }
    if (!dryRun && !wixSiteId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'ERROR: WIX_SITE_ID environment variable is required for catalog import',
          },
        ],
      };
    }

    const result = await veloCatalogImport(
      { apiKey: wixApiKey, siteId: wixSiteId },
      { catalogPath, dryRun, category },
    );
    return { content: [{ type: 'text' as const, text: result }] };
  },
);

// ── velo_secrets_set ─────────────────────────────────────────────────

server.registerTool(
  'velo_secrets_set',
  {
    description:
      'Create or update a secret in Wix Secrets Manager. If the secret name already exists, it is updated; otherwise a new secret is created.',
    inputSchema: z.object({
      name: z.string().describe('Secret name (e.g. UPS_API_KEY, STRIPE_SECRET)'),
      value: z.string().describe('Secret value'),
      description: z
        .string()
        .optional()
        .describe('Optional description for the secret'),
    }),
  },
  async ({ name, value, description }) => {
    const result = await veloSecretsSet(config, { name, value, description });
    return { content: [{ type: 'text' as const, text: result }] };
  },
);

// ── velo_email_template_list ─────────────────────────────────────────

server.registerTool(
  'velo_email_template_list',
  {
    description:
      'List triggered email templates configured on the Wix site. Returns template IDs, names, statuses, and variable names.',
    inputSchema: z.object({}),
  },
  async () => {
    const result = await listEmailTemplates(config);
    return { content: [{ type: 'text' as const, text: result }] };
  },
);

// ── velo_email_template_create ──────────────────────────────────────

server.registerTool(
  'velo_email_template_create',
  {
    description:
      'Create a new triggered email template on the Wix site. Supports {{variable}} placeholders in subject and body.',
    inputSchema: z.object({
      displayName: z
        .string()
        .describe('Human-readable template name'),
      subject: z
        .string()
        .describe('Email subject line. Supports {{variable}} placeholders.'),
      body: z
        .string()
        .describe('Email HTML body. Supports {{variable}} placeholders.'),
    }),
  },
  async ({ displayName, subject, body }) => {
    const result = await createEmailTemplate(config, {
      displayName,
      subject,
      body,
    });
    return { content: [{ type: 'text' as const, text: result }] };
  },
);

// ── velo_redirect_list ─────────────────────────────────────────────

server.registerTool(
  'velo_redirect_list',
  {
    description:
      'List URL redirects (301) configured on the Wix site. Returns redirect IDs, old URLs, and new URLs. Requires WIX_API_KEY and WIX_SITE_ID env vars.',
    inputSchema: z.object({}),
  },
  async () => {
    const result = await listRedirects(config);
    return { content: [{ type: 'text' as const, text: result }] };
  },
);

// ── velo_redirect_set ──────────────────────────────────────────────

server.registerTool(
  'velo_redirect_set',
  {
    description:
      'Create a URL redirect (301) on the Wix site. Maps an old URL path to a new URL path or external URL. Important for SEO migration. Requires WIX_API_KEY and WIX_SITE_ID env vars.',
    inputSchema: z.object({
      oldUrl: z
        .string()
        .describe('The old URL path to redirect from (must start with /)'),
      newUrl: z
        .string()
        .describe(
          'The new URL path or full URL to redirect to (must start with / or http)',
        ),
    }),
  },
  async ({ oldUrl, newUrl }) => {
    const result = await setRedirect(config, { oldUrl, newUrl });
    return { content: [{ type: 'text' as const, text: result }] };
  },
);

// ── velo_cms_create ─────────────────────────────────────────────────

const fieldSchema = z.object({
  key: z.string().describe('Field key (e.g. "productName")'),
  displayName: z.string().describe('Human-readable field name'),
  type: z.string().describe('Field type: TEXT, NUMBER, BOOLEAN, DATE, IMAGE, RICH_TEXT, URL, REFERENCE, MULTI_REFERENCE'),
});

const permissionsSchema = z.object({
  insert: z.string().optional().describe('Who can insert: ADMIN, MEMBER, ANYONE'),
  update: z.string().optional().describe('Who can update: ADMIN, MEMBER, ANYONE'),
  remove: z.string().optional().describe('Who can remove: ADMIN, MEMBER, ANYONE'),
  read: z.string().optional().describe('Who can read: ADMIN, MEMBER, ANYONE'),
});

server.registerTool(
  'velo_cms_create',
  {
    description:
      'Create a new CMS data collection on the Wix site. Requires WIX_API_KEY and WIX_SITE_ID env vars.',
    inputSchema: z.object({
      collectionId: z.string().describe('Collection ID (e.g. "Products", "BlogPosts")'),
      displayName: z.string().describe('Human-readable collection name'),
      fields: z.array(fieldSchema).optional().describe('Initial fields to add to the collection'),
      permissions: permissionsSchema.optional().describe('Collection-level permissions'),
    }),
  },
  async ({ collectionId, displayName, fields, permissions }) => {
    const result = await veloCmsCreate(config, { collectionId, displayName, fields, permissions });
    return { content: [{ type: 'text' as const, text: result }] };
  },
);

// ── velo_page_list ──────────────────────────────────────────────────

server.registerTool(
  'velo_page_list',
  {
    description:
      'List pages on the Wix site. Returns page IDs, titles, URLs, and published status. Useful for verifying hookup deployment. Requires WIX_API_KEY and WIX_SITE_ID env vars.',
    inputSchema: z.object({}),
  },
  async () => {
    const result = await veloPageList(config);
    return { content: [{ type: 'text' as const, text: result }] };
  },
);

// ── velo_cms_read ──────────────────────────────────────────────────

server.registerTool(
  'velo_cms_read',
  {
    description:
      'Read CMS collection schema (fields, permissions) or list all collections. Requires WIX_API_KEY and WIX_SITE_ID env vars.',
    inputSchema: z.object({
      collectionId: z.string().optional().describe('Collection ID to read. Omit to list all collections.'),
    }),
  },
  async ({ collectionId }) => {
    const result = await veloCmsRead(config, { collectionId });
    return { content: [{ type: 'text' as const, text: result }] };
  },
);

// ── velo_cms_update ─────────────────────────────────────────────────

server.registerTool(
  'velo_cms_update',
  {
    description:
      'Update a CMS collection: rename, add/modify fields, or change permissions. Requires WIX_API_KEY and WIX_SITE_ID env vars.',
    inputSchema: z.object({
      collectionId: z.string().describe('Collection ID to update'),
      displayName: z.string().optional().describe('New display name for the collection'),
      fields: z.array(fieldSchema).optional().describe('Fields to add or update'),
      permissions: permissionsSchema.optional().describe('Updated collection permissions'),
    }),
  },
  async ({ collectionId, displayName, fields, permissions }) => {
    const result = await veloCmsUpdate(config, { collectionId, displayName, fields, permissions });
    return { content: [{ type: 'text' as const, text: result }] };
  },
);

// ── velo_data_item_query ────────────────────────────────────────────

server.registerTool(
  'velo_data_item_query',
  {
    description:
      'Query data items from a CMS collection with optional filter, sort, and paging. Use Wix query language for filters (e.g. { "price": { "$gt": 100 } }). Requires WIX_API_KEY and WIX_SITE_ID env vars.',
    inputSchema: z.object({
      dataCollectionId: z.string().describe('Collection ID to query (e.g. "Products", "Reviews")'),
      filter: z.record(z.unknown()).optional().describe('Wix query language filter object (e.g. { "status": "active" })'),
      sort: z.array(z.object({
        fieldName: z.string().describe('Field to sort by'),
        order: z.string().describe('Sort order: ASC or DESC'),
      })).optional().describe('Sort clauses'),
      limit: z.number().optional().describe('Max items to return (1-100, default 50)'),
      offset: z.number().optional().describe('Number of items to skip (for pagination)'),
    }),
  },
  async ({ dataCollectionId, filter, sort, limit, offset }) => {
    const result = await veloDataItemQuery(config, { dataCollectionId, filter, sort, limit, offset });
    return { content: [{ type: 'text' as const, text: result }] };
  },
);

// ── velo_data_item_list ─────────────────────────────────────────────

server.registerTool(
  'velo_data_item_list',
  {
    description:
      'List data items from a CMS collection (simple listing, no filter/sort). For filtered queries use velo_data_item_query. Requires WIX_API_KEY and WIX_SITE_ID env vars.',
    inputSchema: z.object({
      dataCollectionId: z.string().describe('Collection ID to list items from'),
      limit: z.number().optional().describe('Max items to return (1-100, default 50)'),
    }),
  },
  async ({ dataCollectionId, limit }) => {
    const result = await veloDataItemList(config, { dataCollectionId, limit });
    return { content: [{ type: 'text' as const, text: result }] };
  },
);

// ── velo_data_item_insert ───────────────────────────────────────────

server.registerTool(
  'velo_data_item_insert',
  {
    description:
      'Insert a data item into a CMS collection. Provide field values as key-value pairs in data. Requires WIX_API_KEY and WIX_SITE_ID env vars.',
    inputSchema: z.object({
      dataCollectionId: z.string().describe('Collection ID to insert into'),
      data: z.record(z.unknown()).describe('Item data as key-value pairs (e.g. { "name": "Futon", "price": 299 })'),
    }),
  },
  async ({ dataCollectionId, data }) => {
    const result = await veloDataItemInsert(config, { dataCollectionId, data });
    return { content: [{ type: 'text' as const, text: result }] };
  },
);

// ── velo_data_item_update ───────────────────────────────────────────

server.registerTool(
  'velo_data_item_update',
  {
    description:
      'Update a data item in a CMS collection (full replacement). All fields in data replace existing item fields. Requires WIX_API_KEY and WIX_SITE_ID env vars.',
    inputSchema: z.object({
      dataCollectionId: z.string().describe('Collection ID containing the item'),
      itemId: z.string().describe('ID of the item to update'),
      data: z.record(z.unknown()).describe('Updated item data (replaces all existing fields)'),
    }),
  },
  async ({ dataCollectionId, itemId, data }) => {
    const result = await veloDataItemUpdate(config, { dataCollectionId, itemId, data });
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
