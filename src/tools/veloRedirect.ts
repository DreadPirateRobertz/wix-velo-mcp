import type { VeloConfig } from '../lib/config.js';
import { validateWixApiConfig, wixApiFetch } from '../lib/wixApi.js';

const REDIRECTS_API_PATH = '/url-redirects/v1/redirects';

interface RedirectEntry {
  id: string;
  oldUrl: string;
  newUrl: string;
}

interface SetRedirectInput {
  oldUrl: string;
  newUrl: string;
}

/**
 * List all URL redirects (301) configured on the Wix site.
 */
export async function listRedirects(config: VeloConfig): Promise<string> {
  const configErr = validateWixApiConfig(config);
  if (configErr) return configErr;

  const result = await wixApiFetch(config, 'GET', REDIRECTS_API_PATH);

  if (!result.ok) {
    return `ERROR: Failed to list redirects (${result.status}): ${JSON.stringify(result.body)}`;
  }

  const redirects = (result.body.redirects ?? []) as RedirectEntry[];
  if (redirects.length === 0) {
    return 'No redirects configured on this site.';
  }

  const lines = redirects.map(
    (r) => `• ${r.oldUrl} → ${r.newUrl} (id: ${r.id})`,
  );
  return `${redirects.length} redirect(s):\n${lines.join('\n')}`;
}

/**
 * Create a URL redirect (301) on the Wix site.
 */
export async function setRedirect(
  config: VeloConfig,
  input: SetRedirectInput,
): Promise<string> {
  const configErr = validateWixApiConfig(config);
  if (configErr) return configErr;

  if (!input.oldUrl.trim()) {
    return 'ERROR: oldUrl must not be empty';
  }
  if (!input.newUrl.trim()) {
    return 'ERROR: newUrl must not be empty';
  }
  if (!input.oldUrl.startsWith('/')) {
    return 'ERROR: oldUrl must start with /';
  }
  if (!input.newUrl.startsWith('/') && !input.newUrl.startsWith('http')) {
    return 'ERROR: newUrl must start with / or http';
  }

  const result = await wixApiFetch(config, 'POST', REDIRECTS_API_PATH, {
    redirect: { oldUrl: input.oldUrl, newUrl: input.newUrl },
  });

  if (!result.ok) {
    return `ERROR: Failed to create redirect (${result.status}): ${JSON.stringify(result.body)}`;
  }

  const redirect = result.body.redirect as { id?: string } | undefined;
  const id = redirect?.id ?? 'unknown';
  return `Created redirect: ${input.oldUrl} → ${input.newUrl} (id: ${id})`;
}
