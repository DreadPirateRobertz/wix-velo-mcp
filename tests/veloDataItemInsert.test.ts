import { describe, it, expect, vi, beforeEach } from 'vitest';
import { veloDataItemInsert } from '../src/tools/veloDataItemInsert.js';
import type { VeloConfig } from '../src/lib/config.js';

const mockWixApiFetch = vi.fn();
const mockValidateWixApiConfig = vi.fn();

vi.mock('../src/lib/wixApi.js', () => ({
  wixApiFetch: (...args: unknown[]) => mockWixApiFetch(...args),
  validateWixApiConfig: (...args: unknown[]) => mockValidateWixApiConfig(...args),
}));

describe('veloDataItemInsert', () => {
  const config: VeloConfig = {
    devRepo: '/dev', prodRepo: '/prod',
    wixApiKey: 'test-key', wixSiteId: 'test-site',
  };

  beforeEach(() => {
    mockWixApiFetch.mockReset();
    mockValidateWixApiConfig.mockReset();
    mockValidateWixApiConfig.mockReturnValue(null);
  });

  it('returns ERROR when API config is invalid', async () => {
    mockValidateWixApiConfig.mockReturnValue('ERROR: WIX_API_KEY missing');

    const result = await veloDataItemInsert(config, {
      dataCollectionId: 'Products',
      data: { name: 'Test' },
    });
    expect(result).toContain('ERROR');
    expect(mockWixApiFetch).not.toHaveBeenCalled();
  });

  it('returns ERROR when dataCollectionId is empty', async () => {
    const result = await veloDataItemInsert(config, {
      dataCollectionId: '',
      data: { name: 'Test' },
    });
    expect(result).toContain('ERROR');
    expect(result).toContain('dataCollectionId');
  });

  it('rejects dataCollectionId with path traversal characters', async () => {
    for (const bad of ['../secret', 'Col/evil', 'a..b']) {
      const result = await veloDataItemInsert(config, {
        dataCollectionId: bad,
        data: { name: 'Test' },
      });
      expect(result).toContain('ERROR');
      expect(mockWixApiFetch).not.toHaveBeenCalled();
    }
  });

  it('returns ERROR when data is empty object', async () => {
    const result = await veloDataItemInsert(config, {
      dataCollectionId: 'Products',
      data: {},
    });
    expect(result).toContain('ERROR');
    expect(result).toContain('data');
  });

  it('inserts a single item successfully', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true, status: 200,
      body: {
        dataItem: { _id: 'new-id-123', data: { name: 'Futon Frame', price: 299 } },
      },
    });

    const result = await veloDataItemInsert(config, {
      dataCollectionId: 'Products',
      data: { name: 'Futon Frame', price: 299 },
    });

    expect(result).toContain('new-id-123');
    expect(result).toContain('successfully');
    expect(mockWixApiFetch).toHaveBeenCalledWith(
      config, 'POST', '/wix-data/v2/items',
      {
        dataCollectionId: 'Products',
        dataItem: { data: { name: 'Futon Frame', price: 299 } },
      },
    );
  });

  it('returns ERROR on API failure', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: false, status: 400,
      body: { message: 'Invalid field type' },
    });

    const result = await veloDataItemInsert(config, {
      dataCollectionId: 'Products',
      data: { name: 'Test' },
    });
    expect(result).toContain('ERROR');
    expect(result).toContain('400');
  });

  it('returns ERROR on duplicate ID', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: false, status: 409,
      body: { message: 'Item with this ID already exists' },
    });

    const result = await veloDataItemInsert(config, {
      dataCollectionId: 'Products',
      data: { _id: 'existing', name: 'Test' },
    });
    expect(result).toContain('ERROR');
    expect(result).toContain('409');
  });

  it('returns ERROR on network failure', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: false, status: 0,
      body: { error: 'fetch failed' },
    });

    const result = await veloDataItemInsert(config, {
      dataCollectionId: 'Products',
      data: { name: 'Test' },
    });
    expect(result).toContain('ERROR');
  });
});
