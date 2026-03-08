import type { VeloConfig } from '../lib/config.js';

const REDIRECTS_API_BASE =
  'https://www.wixapis.com/url-redirects/v1/redirects';

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
  if (!config.wixApiKey) {
    return 'ERROR: WIX_API_KEY environment variable is required for redirect tools';
  }
  if (!config.wixSiteId) {
    return 'ERROR: WIX_SITE_ID environment variable is required for redirect tools';
  }

  const headers: Record<string, string> = {
    Authorization: config.wixApiKey,
    'wix-site-id': config.wixSiteId,
    'Content-Type': 'application/json',
  };

  try {
    const res = await fetch(REDIRECTS_API_BASE, { method: 'GET', headers });
    if (!res.ok) {
      const text = await res.text();
      return `ERROR: Failed to list redirects (${res.status}): ${text}`;
    }

    const text = await res.text();
    let parsed: { redirects?: RedirectEntry[] };
    try {
      parsed = JSON.parse(text) as { redirects?: RedirectEntry[] };
    } catch {
      parsed = { redirects: [] };
    }

    const redirects = parsed.redirects ?? [];
    if (redirects.length === 0) {
      return 'No redirects configured on this site.';
    }

    const lines = redirects.map(
      (r) => `• ${r.oldUrl} → ${r.newUrl} (id: ${r.id})`,
    );
    return `${redirects.length} redirect(s):\n${lines.join('\n')}`;
  } catch (err) {
    return `ERROR: Failed to list redirects: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Create a URL redirect (301) on the Wix site.
 */
export async function setRedirect(
  config: VeloConfig,
  input: SetRedirectInput,
): Promise<string> {
  if (!config.wixApiKey) {
    return 'ERROR: WIX_API_KEY environment variable is required for redirect tools';
  }
  if (!config.wixSiteId) {
    return 'ERROR: WIX_SITE_ID environment variable is required for redirect tools';
  }

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

  const headers: Record<string, string> = {
    Authorization: config.wixApiKey,
    'wix-site-id': config.wixSiteId,
    'Content-Type': 'application/json',
  };

  try {
    const res = await fetch(REDIRECTS_API_BASE, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        redirect: { oldUrl: input.oldUrl, newUrl: input.newUrl },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return `ERROR: Failed to create redirect (${res.status}): ${text}`;
    }

    const text = await res.text();
    let parsed: { redirect?: { id?: string } };
    try {
      parsed = JSON.parse(text) as { redirect?: { id?: string } };
    } catch {
      parsed = {};
    }

    const id = parsed.redirect?.id ?? 'unknown';
    return `Created redirect: ${input.oldUrl} → ${input.newUrl} (id: ${id})`;
  } catch (err) {
    return `ERROR: Failed to create redirect: ${err instanceof Error ? err.message : String(err)}`;
  }
}
