import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VeloConfig } from '../src/lib/config.js';

// Mock fetch at module level
const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = mockFetch;
  mockFetch.mockReset();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// Dynamic import after mock setup
const { veloSecretsSet } = await import('../src/tools/veloSecretsSet.js');

const config: VeloConfig = {
  devRepo: '/dev',
  prodRepo: '/prod',
  wixApiKey: 'test-api-key',
  wixSiteId: 'test-site-id',
};

const configNoKey: VeloConfig = {
  devRepo: '/dev',
  prodRepo: '/prod',
};

describe('veloSecretsSet', () => {
  // ── Input validation ──────────────────────────────────────────────

  it('returns error when wixApiKey is missing', async () => {
    const result = await veloSecretsSet(configNoKey, {
      name: 'MY_SECRET',
      value: 'secret-value',
    });
    expect(result).toContain('ERROR');
    expect(result).toContain('WIX_API_KEY');
  });

  it('returns error when wixSiteId is missing', async () => {
    const partial: VeloConfig = {
      devRepo: '/dev',
      prodRepo: '/prod',
      wixApiKey: 'key',
    };
    const result = await veloSecretsSet(partial, {
      name: 'MY_SECRET',
      value: 'secret-value',
    });
    expect(result).toContain('ERROR');
    expect(result).toContain('WIX_SITE_ID');
  });

  it('returns error for empty secret name', async () => {
    const result = await veloSecretsSet(config, {
      name: '',
      value: 'secret-value',
    });
    expect(result).toContain('ERROR');
    expect(result).toMatch(/name/i);
  });

  it('returns error for empty secret value', async () => {
    const result = await veloSecretsSet(config, {
      name: 'MY_SECRET',
      value: '',
    });
    expect(result).toContain('ERROR');
    expect(result).toMatch(/value/i);
  });

  // ── Create flow (secret doesn't exist) ────────────────────────────

  it('creates a new secret when name not found in list', async () => {
    // List returns empty
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ secrets: [] }),
    });
    // Create succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ secret: { id: 'new-id', name: 'MY_SECRET' } }),
    });

    const result = await veloSecretsSet(config, {
      name: 'MY_SECRET',
      value: 'secret-value',
    });

    expect(result).toContain('Created');
    expect(result).toContain('MY_SECRET');

    // Verify create call
    const createCall = mockFetch.mock.calls[1];
    expect(createCall[1].method).toBe('POST');
    const body = JSON.parse(createCall[1].body);
    expect(body.secret.name).toBe('MY_SECRET');
    expect(body.secret.value).toBe('secret-value');
  });

  it('sends correct auth headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ secrets: [] }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ secret: { id: 'id', name: 'X' } }),
    });

    await veloSecretsSet(config, { name: 'X', value: 'v' });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('test-api-key');
    expect(headers['wix-site-id']).toBe('test-site-id');
  });

  it('includes description in create request when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ secrets: [] }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ secret: { id: 'id', name: 'KEY' } }),
    });

    await veloSecretsSet(config, {
      name: 'KEY',
      value: 'val',
      description: 'My API key',
    });

    const body = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(body.secret.description).toBe('My API key');
  });

  // ── Update flow (secret already exists) ───────────────────────────

  it('updates existing secret when name already exists', async () => {
    // List returns existing secret
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          secrets: [{ id: 'existing-id', name: 'MY_SECRET' }],
        }),
    });
    // Update succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ secret: { id: 'existing-id', name: 'MY_SECRET' } }),
    });

    const result = await veloSecretsSet(config, {
      name: 'MY_SECRET',
      value: 'new-value',
    });

    expect(result).toContain('Updated');
    expect(result).toContain('MY_SECRET');

    // Verify update call uses PATCH with correct ID
    const updateCall = mockFetch.mock.calls[1];
    expect(updateCall[0]).toContain('existing-id');
    expect(updateCall[1].method).toBe('PATCH');
    const body = JSON.parse(updateCall[1].body);
    expect(body.secret.value).toBe('new-value');
  });

  it('matches secret name case-sensitively', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          secrets: [{ id: 'id-1', name: 'my_secret' }],
        }),
    });
    // Different case — should create, not update
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ secret: { id: 'id-2', name: 'MY_SECRET' } }),
    });

    const result = await veloSecretsSet(config, {
      name: 'MY_SECRET',
      value: 'val',
    });

    expect(result).toContain('Created');
    expect(mockFetch.mock.calls[1][1].method).toBe('POST');
  });

  // ── Error handling ────────────────────────────────────────────────

  it('returns error when list request fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const result = await veloSecretsSet(config, {
      name: 'MY_SECRET',
      value: 'val',
    });

    expect(result).toContain('ERROR');
    expect(result).toMatch(/list/i);
  });

  it('returns error when create request fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ secrets: [] }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ message: 'Forbidden' }),
    });

    const result = await veloSecretsSet(config, {
      name: 'MY_SECRET',
      value: 'val',
    });

    expect(result).toContain('ERROR');
  });

  it('returns error when update request fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          secrets: [{ id: 'existing-id', name: 'MY_SECRET' }],
        }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ message: 'Bad Request' }),
    });

    const result = await veloSecretsSet(config, {
      name: 'MY_SECRET',
      value: 'val',
    });

    expect(result).toContain('ERROR');
  });

  it('handles network errors without throwing', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await veloSecretsSet(config, {
      name: 'MY_SECRET',
      value: 'val',
    });

    expect(result).toContain('ERROR');
    expect(result).toContain('ECONNREFUSED');
  });

  it('handles non-JSON list response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'not json',
    });

    const result = await veloSecretsSet(config, {
      name: 'MY_SECRET',
      value: 'val',
    });

    // Should handle gracefully (treat as empty secrets list or error)
    expect(typeof result).toBe('string');
  });

  // ── Pagination — list returns secrets but none match ──────────────

  it('creates secret when list has other secrets but not the target', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          secrets: [
            { id: 'id-a', name: 'OTHER_SECRET' },
            { id: 'id-b', name: 'ANOTHER_ONE' },
          ],
        }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ secret: { id: 'id-c', name: 'MY_SECRET' } }),
    });

    const result = await veloSecretsSet(config, {
      name: 'MY_SECRET',
      value: 'val',
    });

    expect(result).toContain('Created');
    expect(mockFetch.mock.calls[1][1].method).toBe('POST');
  });
});
