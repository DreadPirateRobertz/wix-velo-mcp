import type { VeloConfig } from '../lib/config.js';
import { validateWixApiConfig, wixApiFetch } from '../lib/wixApi.js';

const COLLECTIONS_PATH = '/wix-data/v2/collections';

interface CmsField {
  key: string;
  displayName: string;
  type: string;
}

interface CmsPermissions {
  insert?: string;
  update?: string;
  remove?: string;
  read?: string;
}

interface CmsUpdateInput {
  collectionId: string;
  displayName?: string;
  fields?: CmsField[];
  permissions?: CmsPermissions;
}

/**
 * Update an existing CMS collection via the Wix Data Collections API.
 * Returns a human-readable result string (never throws).
 */
export async function veloCmsUpdate(
  config: VeloConfig,
  input: CmsUpdateInput,
): Promise<string> {
  const configError = validateWixApiConfig(config);
  if (configError) return configError;

  if (!input.collectionId) {
    return 'ERROR: collectionId is required and must be non-empty';
  }

  const hasUpdate = input.displayName || input.fields || input.permissions;
  if (!hasUpdate) {
    return 'ERROR: at least one of displayName, fields, or permissions must be provided';
  }

  const collection: Record<string, unknown> = {};

  if (input.displayName) {
    collection.displayName = input.displayName;
  }
  if (input.fields) {
    collection.fields = input.fields;
  }
  if (input.permissions) {
    collection.permissions = input.permissions;
  }

  const result = await wixApiFetch(
    config,
    'PATCH',
    `${COLLECTIONS_PATH}/${input.collectionId}`,
    { collection },
  );

  if (!result.ok) {
    const msg = (result.body.message as string) || JSON.stringify(result.body);
    return `ERROR: Failed to update collection (${result.status}): ${msg}`;
  }

  return `Updated collection "${input.collectionId}" successfully.`;
}
