import type { VeloConfig } from '../lib/config.js';
import { validateWixApiConfig, wixApiFetch } from '../lib/wixApi.js';

const PAGES_LIST_PATH = '/v1/site-pages/list';

interface SitePage {
  id: string;
  title: string | null;
  url?: string;
  published?: boolean;
}

/**
 * List pages on the Wix site via REST API.
 * Returns page ID, title, URL, and published status.
 */
export async function veloPageList(config: VeloConfig): Promise<string> {
  const configErr = validateWixApiConfig(config);
  if (configErr) return configErr;

  const result = await wixApiFetch(config, 'GET', PAGES_LIST_PATH);

  if (!result.ok) {
    return `Error listing pages (HTTP ${result.status}): ${JSON.stringify(result.body)}`;
  }

  const pages = (result.body.pages ?? []) as SitePage[];
  if (pages.length === 0) {
    return 'No pages found on the site.';
  }

  const lines = pages.map((p) => {
    const title = p.title || '(untitled)';
    const url = p.url || '(no url)';
    const status = p.published === false ? 'draft' : 'published';
    return `  ${p.id}  ${title}  ${url}  [${status}]`;
  });

  return `Site Pages (${pages.length}):\n${lines.join('\n')}`;
}
