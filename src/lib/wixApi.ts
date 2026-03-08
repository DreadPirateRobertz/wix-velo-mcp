import type { VeloConfig } from './config.js';

const WIX_API_HOST = 'https://www.wixapis.com';

export interface WixApiResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

/**
 * Validate that Wix API config fields are present.
 * Returns an error string if missing, or null if valid.
 */
export function validateWixApiConfig(config: VeloConfig): string | null {
  if (!config.wixApiKey) {
    return 'ERROR: WIX_API_KEY environment variable is required for Wix API tools';
  }
  if (!config.wixSiteId) {
    return 'ERROR: WIX_SITE_ID environment variable is required for Wix API tools';
  }
  return null;
}

/**
 * Make an authenticated request to any Wix REST API endpoint.
 * Pass a path starting with / (e.g. /v3/triggered-emails/templates/query).
 * Never throws — returns a structured result.
 */
export async function wixApiFetch(
  config: VeloConfig,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<WixApiResult> {
  const url = path.startsWith('http') ? path : `${WIX_API_HOST}${path}`;

  const headers: Record<string, string> = {
    Authorization: config.wixApiKey!,
    'wix-site-id': config.wixSiteId!,
    'Content-Type': 'application/json',
  };
  if (config.wixAccountId) {
    headers['wix-account-id'] = config.wixAccountId;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const text = await response.text();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { rawText: text };
    }

    return { ok: response.ok, status: response.status, body: parsed };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: { error: err instanceof Error ? err.message : String(err) },
    };
  }
}
