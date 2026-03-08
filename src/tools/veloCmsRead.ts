import type { VeloConfig } from '../lib/config.js';
import { validateWixApiConfig, wixApiFetch } from '../lib/wixApi.js';

const COLLECTIONS_PATH = '/wix-data/v2/collections';

interface CmsReadInput {
  collectionId?: string;
}

/**
 * Read a CMS collection schema (or list all collections) via the Wix Data Collections API.
 * Returns a human-readable result string (never throws).
 */
export async function veloCmsRead(
  config: VeloConfig,
  input: CmsReadInput,
): Promise<string> {
  const configError = validateWixApiConfig(config);
  if (configError) return configError;

  const path = input.collectionId
    ? `${COLLECTIONS_PATH}/${input.collectionId}`
    : COLLECTIONS_PATH;
  const result = await wixApiFetch(config, 'GET', path);

  if (!result.ok) {
    const msg = (result.body.message as string) || JSON.stringify(result.body);
    return `ERROR: Failed to read collection (${result.status}): ${msg}`;
  }

  // Single collection
  if (input.collectionId) {
    return formatCollection(result.body.collection as Record<string, unknown> | undefined);
  }

  // List all collections
  const collections = result.body.collections as Record<string, unknown>[] | undefined;
  if (!collections || collections.length === 0) {
    return 'No collections found.';
  }

  const lines = ['Collections:', ''];
  for (const coll of collections) {
    lines.push(`  ${coll.id} — ${coll.displayName || '(no display name)'}`);
  }
  return lines.join('\n');
}

function formatCollection(coll: Record<string, unknown> | undefined): string {
  if (!coll) return 'Collection data not available.';

  const lines: string[] = [];
  lines.push(`Collection: ${coll.displayName || coll.id}`);
  lines.push(`ID: ${coll.id}`);

  const fields = coll.fields as Array<Record<string, unknown>> | undefined;
  if (fields && fields.length > 0) {
    lines.push('');
    lines.push('Fields:');
    for (const f of fields) {
      lines.push(`  ${f.key} (${f.type}) — ${f.displayName || ''}`);
    }
  } else {
    lines.push('');
    lines.push('Fields: none');
  }

  const perms = coll.permissions as Record<string, string> | undefined;
  if (perms) {
    lines.push('');
    lines.push('Permissions:');
    for (const [action, level] of Object.entries(perms)) {
      lines.push(`  ${action}: ${level}`);
    }
  }

  return lines.join('\n');
}
