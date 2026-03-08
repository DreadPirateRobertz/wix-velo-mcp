import type { VeloConfig } from '../lib/config.js';
import { validateWixApiConfig, wixApiFetch } from '../lib/wixApi.js';

const ITEMS_QUERY_PATH = '/wix-data/v2/items/query';

interface SortClause {
  fieldName: string;
  order: string;
}

interface DataItemQueryInput {
  dataCollectionId: string;
  filter?: Record<string, unknown>;
  sort?: SortClause[];
  limit?: number;
  offset?: number;
}

/**
 * Query data items from a CMS collection with optional filter, sort, and paging.
 * Returns a human-readable result string (never throws).
 */
export async function veloDataItemQuery(
  config: VeloConfig,
  input: DataItemQueryInput,
): Promise<string> {
  const configError = validateWixApiConfig(config);
  if (configError) return configError;

  if (!input.dataCollectionId) {
    return 'ERROR: dataCollectionId is required and must be non-empty';
  }

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const offset = input.offset ?? 0;

  const query: Record<string, unknown> = {
    paging: { limit, offset },
  };

  if (input.filter) {
    query.filter = input.filter;
  }
  if (input.sort) {
    query.sort = input.sort;
  }

  const result = await wixApiFetch(config, 'POST', ITEMS_QUERY_PATH, {
    dataCollectionId: input.dataCollectionId,
    query,
  });

  if (!result.ok) {
    const msg = (result.body.message as string) || JSON.stringify(result.body);
    return `ERROR: Failed to query items (${result.status}): ${msg}`;
  }

  return formatQueryResult(result.body);
}

function formatQueryResult(body: Record<string, unknown>): string {
  const items = body.dataItems as Array<Record<string, unknown>> | undefined;
  const paging = body.pagingMetadata as Record<string, number> | undefined;
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
