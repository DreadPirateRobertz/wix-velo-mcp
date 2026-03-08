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

interface CmsCreateInput {
  collectionId: string;
  displayName: string;
  fields?: CmsField[];
  permissions?: CmsPermissions;
}

/**
 * Create a new CMS collection via the Wix Data Collections API.
 * Returns a human-readable result string (never throws).
 */
export async function veloCmsCreate(
  config: VeloConfig,
  input: CmsCreateInput,
): Promise<string> {
  const configError = validateWixApiConfig(config);
  if (configError) return configError;

  if (!input.collectionId) {
    return 'ERROR: collectionId is required and must be non-empty';
  }
  if (!input.displayName) {
    return 'ERROR: displayName is required and must be non-empty';
  }

  const collection: Record<string, unknown> = {
    id: input.collectionId,
    displayName: input.displayName,
  };

  if (input.fields) {
    collection.fields = input.fields;
  }
  if (input.permissions) {
    collection.permissions = input.permissions;
  }

  const result = await wixApiFetch(config, 'POST', COLLECTIONS_PATH, { collection });

  if (!result.ok) {
    const msg = (result.body.message as string) || JSON.stringify(result.body);
    return `ERROR: Failed to create collection (${result.status}): ${msg}`;
  }

  const created = result.body.collection as Record<string, unknown> | undefined;
  const id = created?.id ?? input.collectionId;
  return `Created collection "${id}" successfully.`;
}
