import type { VeloConfig } from '../lib/config.js';
import { validateWixApiConfig, wixApiFetch } from '../lib/wixApi.js';

const ITEMS_PATH = '/wix-data/v2/items';

interface DataItemInsertInput {
  dataCollectionId: string;
  data: Record<string, unknown>;
}

/**
 * Insert a data item into a CMS collection.
 * Returns a human-readable result string (never throws).
 */
export async function veloDataItemInsert(
  config: VeloConfig,
  input: DataItemInsertInput,
): Promise<string> {
  const configError = validateWixApiConfig(config);
  if (configError) return configError;

  if (!input.dataCollectionId) {
    return 'ERROR: dataCollectionId is required and must be non-empty';
  }

  if (!input.data || Object.keys(input.data).length === 0) {
    return 'ERROR: data is required and must be non-empty';
  }

  const result = await wixApiFetch(config, 'POST', ITEMS_PATH, {
    dataCollectionId: input.dataCollectionId,
    dataItem: { data: input.data },
  });

  if (!result.ok) {
    const msg = (result.body.message as string) || JSON.stringify(result.body);
    return `ERROR: Failed to insert item (${result.status}): ${msg}`;
  }

  const created = result.body.dataItem as Record<string, unknown> | undefined;
  const id = created?._id ?? '(unknown)';
  return `Inserted item "${id}" into "${input.dataCollectionId}" successfully.`;
}
