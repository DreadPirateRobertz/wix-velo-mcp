import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateWixApiConfig, wixApiFetch } from '../src/lib/wixApi.js';
import type { VeloConfig } from '../src/lib/config.js';

describe('validateWixApiConfig', () => {
  it('returns null when both wixApiKey and wixSiteId are present', () => {
    const config: VeloConfig = {
      devRepo: '/dev', prodRepo: '/prod',
      wixApiKey: 'test-key', wixSiteId: 'test-site',
    };
    expect(validateWixApiConfig(config)).toBeNull();
  });

  it('returns error when wixApiKey is missing', () => {
    const config: VeloConfig = {
      devRepo: '/dev', prodRepo: '/prod',
      wixSiteId: 'test-site',
    };
    expect(validateWixApiConfig(config)).toContain('WIX_API_KEY');
  });

  it('returns error when wixSiteId is missing', () => {
    const config: VeloConfig = {
      devRepo: '/dev', prodRepo: '/prod',
      wixApiKey: 'test-key',
    };
    expect(validateWixApiConfig(config)).toContain('WIX_SITE_ID');
  });

  it('returns error when both are missing', () => {
    const config: VeloConfig = { devRepo: '/dev', prodRepo: '/prod' };
    const result = validateWixApiConfig(config);
    expect(result).toContain('ERROR');
  });
});

describe('wixApiFetch', () => {
  const config: VeloConfig = {
    devRepo: '/dev', prodRepo: '/prod',
    wixApiKey: 'test-key', wixSiteId: 'test-site',
  };

  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('makes GET request with correct auth headers', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"collection": {"id": "test"}}',
    });

    await wixApiFetch(config, 'GET', '/wix-data/v2/collections/myCollection');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://www.wixapis.com/wix-data/v2/collections/myCollection',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'test-key',
          'wix-site-id': 'test-site',
        }),
      }),
    );
  });

  it('sends JSON body for POST requests', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"collection": {"id": "new"}}',
    });

    await wixApiFetch(config, 'POST', '/wix-data/v2/collections', { collection: { id: 'test' } });

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].body).toBe('{"collection":{"id":"test"}}');
  });

  it('returns parsed JSON on success', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"collection": {"id": "test"}}',
    });

    const result = await wixApiFetch(config, 'GET', '/wix-data/v2/collections/test');
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ collection: { id: 'test' } });
  });

  it('returns error result on HTTP failure', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '{"message": "not found"}',
    });

    const result = await wixApiFetch(config, 'GET', '/wix-data/v2/collections/missing');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it('handles network errors without throwing', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('ECONNREFUSED'),
    );

    const result = await wixApiFetch(config, 'GET', '/test');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.body).toEqual({ error: 'ECONNREFUSED' });
  });

  it('handles non-JSON response body', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const result = await wixApiFetch(config, 'GET', '/test');
    expect(result.body).toEqual({ rawText: 'Internal Server Error' });
  });

  it('handles full URLs directly', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"ok": true}',
    });

    await wixApiFetch(config, 'GET', 'https://custom.api.com/endpoint');

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toBe('https://custom.api.com/endpoint');
  });
});
