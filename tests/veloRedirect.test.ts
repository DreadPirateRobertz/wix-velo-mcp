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
const { listRedirects, setRedirect } = await import(
  '../src/tools/veloRedirect.js'
);

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

// ═══════════════════════════════════════════════════════════════════
// listRedirects
// ═══════════════════════════════════════════════════════════════════

describe('listRedirects', () => {
  // ── Config validation ──────────────────────────────────────────

  it('returns error when wixApiKey is missing', async () => {
    const result = await listRedirects(configNoKey);
    expect(result).toContain('ERROR');
    expect(result).toContain('WIX_API_KEY');
  });

  it('returns error when wixSiteId is missing', async () => {
    const partial: VeloConfig = {
      devRepo: '/dev',
      prodRepo: '/prod',
      wixApiKey: 'key',
    };
    const result = await listRedirects(partial);
    expect(result).toContain('ERROR');
    expect(result).toContain('WIX_SITE_ID');
  });

  // ── Success path ───────────────────────────────────────────────

  it('lists redirects with id, oldUrl, and newUrl', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          redirects: [
            { id: 'r1', oldUrl: '/old-page', newUrl: '/new-page' },
            { id: 'r2', oldUrl: '/blog/old', newUrl: '/blog/new' },
          ],
        }),
    });

    const result = await listRedirects(config);

    expect(result).toContain('/old-page');
    expect(result).toContain('/new-page');
    expect(result).toContain('/blog/old');
    expect(result).toContain('/blog/new');
  });

  it('sends correct auth headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ redirects: [] }),
    });

    await listRedirects(config);

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('test-api-key');
    expect(headers['wix-site-id']).toBe('test-site-id');
  });

  it('uses GET method', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ redirects: [] }),
    });

    await listRedirects(config);

    expect(mockFetch.mock.calls[0][1].method).toBe('GET');
  });

  it('reports empty list gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ redirects: [] }),
    });

    const result = await listRedirects(config);

    expect(result).toMatch(/no redirects|0 redirect/i);
  });

  // ── Error handling ─────────────────────────────────────────────

  it('returns error when API responds with failure status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const result = await listRedirects(config);

    expect(result).toContain('ERROR');
    expect(result).toContain('500');
  });

  it('handles network errors without throwing', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await listRedirects(config);

    expect(result).toContain('ERROR');
    expect(result).toContain('ECONNREFUSED');
  });

  it('handles non-JSON response gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'not json',
    });

    const result = await listRedirects(config);

    // Should not throw, should return something sensible
    expect(typeof result).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════════
// setRedirect
// ═══════════════════════════════════════════════════════════════════

describe('setRedirect', () => {
  // ── Config validation ──────────────────────────────────────────

  it('returns error when wixApiKey is missing', async () => {
    const result = await setRedirect(configNoKey, {
      oldUrl: '/old',
      newUrl: '/new',
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
    const result = await setRedirect(partial, {
      oldUrl: '/old',
      newUrl: '/new',
    });
    expect(result).toContain('ERROR');
    expect(result).toContain('WIX_SITE_ID');
  });

  // ── Input validation ──────────────────────────────────────────

  it('returns error for empty oldUrl', async () => {
    const result = await setRedirect(config, { oldUrl: '', newUrl: '/new' });
    expect(result).toContain('ERROR');
    expect(result).toMatch(/oldUrl|old.?url|old URL/i);
  });

  it('returns error for empty newUrl', async () => {
    const result = await setRedirect(config, { oldUrl: '/old', newUrl: '' });
    expect(result).toContain('ERROR');
    expect(result).toMatch(/newUrl|new.?url|new URL/i);
  });

  it('returns error when oldUrl does not start with /', async () => {
    const result = await setRedirect(config, {
      oldUrl: 'old-page',
      newUrl: '/new',
    });
    expect(result).toContain('ERROR');
    expect(result).toMatch(/oldUrl|old.?url|must start with/i);
  });

  it('returns error when newUrl starts with neither / nor http', async () => {
    const result = await setRedirect(config, {
      oldUrl: '/old',
      newUrl: 'new-page',
    });
    expect(result).toContain('ERROR');
    expect(result).toMatch(/newUrl|new.?url|must start with/i);
  });

  it('accepts newUrl starting with http', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          redirect: {
            id: 'r1',
            oldUrl: '/old',
            newUrl: 'https://example.com/new',
          },
        }),
    });

    const result = await setRedirect(config, {
      oldUrl: '/old',
      newUrl: 'https://example.com/new',
    });

    expect(result).not.toContain('ERROR');
    expect(result).toContain('Created');
  });

  it('accepts newUrl starting with /', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          redirect: { id: 'r1', oldUrl: '/old', newUrl: '/new' },
        }),
    });

    const result = await setRedirect(config, {
      oldUrl: '/old',
      newUrl: '/new',
    });

    expect(result).not.toContain('ERROR');
  });

  // ── Create flow ────────────────────────────────────────────────

  it('creates a redirect and returns confirmation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          redirect: { id: 'new-id', oldUrl: '/old-page', newUrl: '/new-page' },
        }),
    });

    const result = await setRedirect(config, {
      oldUrl: '/old-page',
      newUrl: '/new-page',
    });

    expect(result).toContain('Created');
    expect(result).toContain('/old-page');
    expect(result).toContain('/new-page');
  });

  it('sends POST with correct body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          redirect: { id: 'id', oldUrl: '/a', newUrl: '/b' },
        }),
    });

    await setRedirect(config, { oldUrl: '/a', newUrl: '/b' });

    const call = mockFetch.mock.calls[0];
    expect(call[1].method).toBe('POST');
    const body = JSON.parse(call[1].body);
    expect(body.redirect.oldUrl).toBe('/a');
    expect(body.redirect.newUrl).toBe('/b');
  });

  it('sends correct auth headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          redirect: { id: 'id', oldUrl: '/a', newUrl: '/b' },
        }),
    });

    await setRedirect(config, { oldUrl: '/a', newUrl: '/b' });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('test-api-key');
    expect(headers['wix-site-id']).toBe('test-site-id');
    expect(headers['Content-Type']).toBe('application/json');
  });

  // ── Error handling ─────────────────────────────────────────────

  it('returns error when API responds with failure status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ message: 'Forbidden' }),
    });

    const result = await setRedirect(config, {
      oldUrl: '/old',
      newUrl: '/new',
    });

    expect(result).toContain('ERROR');
    expect(result).toContain('403');
  });

  it('returns error on conflict (duplicate redirect)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      text: async () =>
        JSON.stringify({ message: 'Redirect already exists for /old' }),
    });

    const result = await setRedirect(config, {
      oldUrl: '/old',
      newUrl: '/new',
    });

    expect(result).toContain('ERROR');
  });

  it('handles network errors without throwing', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await setRedirect(config, {
      oldUrl: '/old',
      newUrl: '/new',
    });

    expect(result).toContain('ERROR');
    expect(result).toContain('ECONNREFUSED');
  });

  it('handles non-JSON success response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'not json',
    });

    const result = await setRedirect(config, {
      oldUrl: '/old',
      newUrl: '/new',
    });

    // Should handle gracefully — still report creation
    expect(typeof result).toBe('string');
    expect(result).toContain('Created');
  });
});
