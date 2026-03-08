import type { VeloConfig } from '../lib/config.js';
import { validateWixApiConfig, wixApiFetch } from '../lib/wixApi.js';

const ITEMS_QUERY_PATH = '/wix-data/v2/items/query';

interface DataItemListInput {
  dataCollectionId: string;
  limit?: number;
}

/**
 * List data items from a CMS collection (simple query with no filter/sort).
 * Returns a human-readable result string (never throws).
 */
export async function veloDataItemList(
  config: VeloConfig,
  input: DataItemListInput,
): Promise<string> {
  const configError = validateWixApiConfig(config);
  if (configError) return configError;

  if (!input.dataCollectionId) {
    return 'ERROR: dataCollectionId is required and must be non-empty';
  }

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);

  const result = await wixApiFetch(config, 'POST', ITEMS_QUERY_PATH, {
    dataCollectionId: input.dataCollectionId,
    query: { paging: { limit, offset: 0 } },
  });

  if (!result.ok) {
    const msg = (result.body.message as string) || JSON.stringify(result.body);
    return `ERROR: Failed to list items (${result.status}): ${msg}`;
  }

  const items = result.body.dataItems as Array<Record<string, unknown>> | undefined;
  const paging = result.body.pagingMetadata as Record<string, number> | undefined;
  const count = items?.length ?? 0;
  const total = paging?.total ?? count;

  const lines: string[] = [];
  lines.push(`${count} items returned (${total} total)`);

  if (items && items.length > 0) {
    lines.push('');
    for (const item of items) {
      const id = item._id as string;
      const data = item.data as Record<string, unknown> | undefined;
      lines.push(`[${id}] ${JSON.stringify(data)}`);
    }
  }

  return lines.join('\n');
}
