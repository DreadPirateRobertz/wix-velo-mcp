import type { VeloConfig } from '../lib/config.js';
import { validateWixApiConfig, wixApiFetch } from '../lib/wixApi.js';

const ITEMS_PATH = '/wix-data/v2/items';
const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;

interface DataItemUpdateInput {
  dataCollectionId: string;
  itemId: string;
  data: Record<string, unknown>;
}

/**
 * Update a data item in a CMS collection (full replacement of data fields).
 * Returns a human-readable result string (never throws).
 */
export async function veloDataItemUpdate(
  config: VeloConfig,
  input: DataItemUpdateInput,
): Promise<string> {
  const configError = validateWixApiConfig(config);
  if (configError) return configError;

  if (!input.dataCollectionId) {
    return 'ERROR: dataCollectionId is required and must be non-empty';
  }

  if (!SAFE_ID_RE.test(input.dataCollectionId)) {
    return 'ERROR: dataCollectionId contains invalid characters (only alphanumeric, hyphens, underscores allowed)';
  }

  if (!input.itemId) {
    return 'ERROR: itemId is required and must be non-empty';
  }

  if (!SAFE_ID_RE.test(input.itemId)) {
    return 'ERROR: itemId contains invalid characters (only alphanumeric, hyphens, underscores allowed)';
  }

  if (!input.data || Object.keys(input.data).length === 0) {
    return 'ERROR: data is required and must be non-empty';
  }

  const result = await wixApiFetch(
    config,
    'PUT',
    `${ITEMS_PATH}/${input.itemId}`,
    {
      dataCollectionId: input.dataCollectionId,
      dataItem: { _id: input.itemId, data: input.data },
    },
  );

  if (!result.ok) {
    const msg = (result.body.message as string) || JSON.stringify(result.body);
    return `ERROR: Failed to update item (${result.status}): ${msg}`;
  }

  return `Updated item "${input.itemId}" in "${input.dataCollectionId}" successfully.`;
}
