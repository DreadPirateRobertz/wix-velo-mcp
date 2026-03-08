import type { VeloConfig } from '../lib/config.js';

const SECRETS_API_BASE = 'https://www.wixapis.com/secrets/v1/secrets';

interface SecretEntry {
  id: string;
  name: string;
}

interface SecretsSetInput {
  name: string;
  value: string;
  description?: string;
}

/**
 * Create or update a secret in Wix Secrets Manager.
 * Lists existing secrets, then creates or updates as needed.
 */
export async function veloSecretsSet(
  config: VeloConfig,
  input: SecretsSetInput,
): Promise<string> {
  // Validate config
  if (!config.wixApiKey) {
    return 'ERROR: WIX_API_KEY environment variable is required for secrets tools';
  }
  if (!config.wixSiteId) {
    return 'ERROR: WIX_SITE_ID environment variable is required for secrets tools';
  }

  // Validate input
  if (!input.name.trim()) {
    return 'ERROR: Secret name must not be empty';
  }
  if (!input.value.trim()) {
    return 'ERROR: Secret value must not be empty';
  }

  const headers: Record<string, string> = {
    Authorization: config.wixApiKey,
    'wix-site-id': config.wixSiteId,
    'Content-Type': 'application/json',
  };

  // List existing secrets to check for duplicates
  let existing: SecretEntry | undefined;
  try {
    const listRes = await fetch(SECRETS_API_BASE, { method: 'GET', headers });
    if (!listRes.ok) {
      const text = await listRes.text();
      return `ERROR: Failed to list secrets (${listRes.status}): ${text}`;
    }
    const listBody = await listRes.text();
    let parsed: { secrets?: SecretEntry[] };
    try {
      parsed = JSON.parse(listBody) as { secrets?: SecretEntry[] };
    } catch {
      parsed = { secrets: [] };
    }
    existing = (parsed.secrets ?? []).find((s) => s.name === input.name);
  } catch (err) {
    return `ERROR: Failed to list secrets: ${err instanceof Error ? err.message : String(err)}`;
  }

  // Build secret payload
  const secret: Record<string, string> = {
    name: input.name,
    value: input.value,
  };
  if (input.description) {
    secret.description = input.description;
  }

  try {
    if (existing) {
      // Update existing secret
      const res = await fetch(`${SECRETS_API_BASE}/${existing.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ secret }),
      });
      if (!res.ok) {
        const text = await res.text();
        return `ERROR: Failed to update secret "${input.name}" (${res.status}): ${text}`;
      }
      return `Updated secret "${input.name}" (id: ${existing.id})`;
    } else {
      // Create new secret
      const res = await fetch(SECRETS_API_BASE, {
        method: 'POST',
        headers,
        body: JSON.stringify({ secret }),
      });
      if (!res.ok) {
        const text = await res.text();
        return `ERROR: Failed to create secret "${input.name}" (${res.status}): ${text}`;
      }
      const body = await res.text();
      let parsed: { secret?: { id?: string } };
      try {
        parsed = JSON.parse(body) as { secret?: { id?: string } };
      } catch {
        parsed = {};
      }
      const newId = parsed.secret?.id ?? 'unknown';
      return `Created secret "${input.name}" (id: ${newId})`;
    }
  } catch (err) {
    return `ERROR: Failed to set secret "${input.name}": ${err instanceof Error ? err.message : String(err)}`;
  }
}
