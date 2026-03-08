import { describe, it, expect, vi, beforeEach } from 'vitest';
import { veloPageList } from '../src/tools/veloPageList.js';
import type { VeloConfig } from '../src/lib/config.js';

const mockWixApiFetch = vi.fn();

vi.mock('../src/lib/wixApi.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../src/lib/wixApi.js')>();
  return {
    ...orig,
    wixApiFetch: (...args: unknown[]) => mockWixApiFetch(...args),
  };
});

describe('veloPageList', () => {
  const config: VeloConfig = {
    devRepo: '/fake/dev',
    prodRepo: '/fake/prod',
    wixApiKey: 'test-api-key',
    wixSiteId: 'test-site-id',
  };

  beforeEach(() => {
    mockWixApiFetch.mockReset();
  });

  // ═══════════════════════════════════════════════════════════════════
  // Config validation
  // ═══════════════════════════════════════════════════════════════════

  it('returns error when WIX_API_KEY is missing', async () => {
    const noKeyConfig: VeloConfig = {
      devRepo: '/fake/dev',
      prodRepo: '/fake/prod',
    };

    const result = await veloPageList(noKeyConfig);
    expect(result).toContain('ERROR');
    expect(result).toContain('WIX_API_KEY');
  });

  it('returns error when WIX_SITE_ID is missing', async () => {
    const noSiteConfig: VeloConfig = {
      devRepo: '/fake/dev',
      prodRepo: '/fake/prod',
      wixApiKey: 'test-key',
    };

    const result = await veloPageList(noSiteConfig);
    expect(result).toContain('ERROR');
    expect(result).toContain('WIX_SITE_ID');
  });

  // ═══════════════════════════════════════════════════════════════════
  // Successful page listing
  // ═══════════════════════════════════════════════════════════════════

  it('calls wixApiFetch with correct endpoint and method', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: { pages: [] },
    });

    await veloPageList(config);

    expect(mockWixApiFetch).toHaveBeenCalledWith(
      config,
      'GET',
      expect.stringContaining('page'),
    );
  });

  it('returns formatted page list when pages exist', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        pages: [
          {
            id: 'page-001',
            title: 'Home',
            url: '/home',
            published: true,
          },
          {
            id: 'page-002',
            title: 'About Us',
            url: '/about',
            published: true,
          },
          {
            id: 'page-003',
            title: 'Coming Soon',
            url: '/coming-soon',
            published: false,
          },
        ],
      },
    });

    const result = await veloPageList(config);
    expect(result).toContain('Home');
    expect(result).toContain('About Us');
    expect(result).toContain('Coming Soon');
    expect(result).toContain('page-001');
    expect(result).toContain('page-002');
    expect(result).toContain('page-003');
    expect(result).toContain('/home');
    expect(result).toContain('/about');
    expect(result).toContain('3');
  });

  it('shows published status for each page', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        pages: [
          { id: 'p1', title: 'Live Page', url: '/live', published: true },
          { id: 'p2', title: 'Draft Page', url: '/draft', published: false },
        ],
      },
    });

    const result = await veloPageList(config);
    expect(result).toMatch(/Live Page.*published/i);
    expect(result).toMatch(/Draft Page.*draft/i);
  });

  it('returns "no pages found" message when empty', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: { pages: [] },
    });

    const result = await veloPageList(config);
    expect(result).toMatch(/no.*page/i);
  });

  // ═══════════════════════════════════════════════════════════════════
  // Error handling
  // ═══════════════════════════════════════════════════════════════════

  it('returns error message on API failure', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: false,
      status: 401,
      body: { message: 'Unauthorized' },
    });

    const result = await veloPageList(config);
    expect(result).toContain('Error');
    expect(result).toContain('401');
  });

  it('handles network errors gracefully', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: false,
      status: 0,
      body: { error: 'Network error' },
    });

    const result = await veloPageList(config);
    expect(result).toContain('Error');
  });

  it('handles missing pages field in response body', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: {},
    });

    const result = await veloPageList(config);
    expect(result).toMatch(/no.*page/i);
  });

  it('handles pages with missing optional fields gracefully', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        pages: [
          { id: 'p1', title: 'Minimal Page' },
        ],
      },
    });

    const result = await veloPageList(config);
    expect(result).toContain('Minimal Page');
    expect(result).not.toContain('undefined');
  });

  it('handles pages with null or empty title', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        pages: [
          { id: 'p1', title: '', url: '/empty' },
          { id: 'p2', title: null, url: '/notitle' },
        ],
      },
    });

    const result = await veloPageList(config);
    expect(result).toContain('p1');
    expect(result).toContain('p2');
    expect(result).toContain('(untitled)');
    expect(result).not.toContain(' null');
  });
});
