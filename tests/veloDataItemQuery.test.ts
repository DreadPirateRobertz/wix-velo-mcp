import { describe, it, expect, vi, beforeEach } from 'vitest';
import { veloDataItemQuery } from '../src/tools/veloDataItemQuery.js';
import type { VeloConfig } from '../src/lib/config.js';

const mockWixApiFetch = vi.fn();
const mockValidateWixApiConfig = vi.fn();

vi.mock('../src/lib/wixApi.js', () => ({
  wixApiFetch: (...args: unknown[]) => mockWixApiFetch(...args),
  validateWixApiConfig: (...args: unknown[]) => mockValidateWixApiConfig(...args),
}));

describe('veloDataItemQuery', () => {
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

    const result = await veloDataItemQuery(config, { dataCollectionId: 'Products' });
    expect(result).toContain('ERROR');
    expect(mockWixApiFetch).not.toHaveBeenCalled();
  });

  it('returns ERROR when dataCollectionId is empty', async () => {
    const result = await veloDataItemQuery(config, { dataCollectionId: '' });
    expect(result).toContain('ERROR');
    expect(result).toContain('dataCollectionId');
    expect(mockWixApiFetch).not.toHaveBeenCalled();
  });

  it('queries items with default paging (limit 50)', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true, status: 200,
      body: {
        dataItems: [
          { _id: 'item1', data: { name: 'Futon Frame', price: 299 } },
          { _id: 'item2', data: { name: 'Mattress', price: 199 } },
        ],
        pagingMetadata: { count: 2, total: 2 },
      },
    });

    const result = await veloDataItemQuery(config, { dataCollectionId: 'Products' });

    expect(result).toContain('2 items');
    expect(result).toContain('item1');
    expect(result).toContain('Futon Frame');
    expect(mockWixApiFetch).toHaveBeenCalledWith(
      config, 'POST', '/wix-data/v2/items/query',
      expect.objectContaining({
        dataCollectionId: 'Products',
        query: expect.objectContaining({
          paging: { limit: 50, offset: 0 },
        }),
      }),
    );
  });

  it('passes filter to API when provided', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true, status: 200,
      body: { dataItems: [], pagingMetadata: { count: 0, total: 0 } },
    });

    await veloDataItemQuery(config, {
      dataCollectionId: 'Products',
      filter: { price: { $gt: 100 } },
    });

    expect(mockWixApiFetch).toHaveBeenCalledWith(
      config, 'POST', '/wix-data/v2/items/query',
      expect.objectContaining({
        query: expect.objectContaining({
          filter: { price: { $gt: 100 } },
        }),
      }),
    );
  });

  it('passes sort to API when provided', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true, status: 200,
      body: { dataItems: [], pagingMetadata: { count: 0, total: 0 } },
    });

    await veloDataItemQuery(config, {
      dataCollectionId: 'Products',
      sort: [{ fieldName: 'price', order: 'DESC' }],
    });

    expect(mockWixApiFetch).toHaveBeenCalledWith(
      config, 'POST', '/wix-data/v2/items/query',
      expect.objectContaining({
        query: expect.objectContaining({
          sort: [{ fieldName: 'price', order: 'DESC' }],
        }),
      }),
    );
  });

  it('respects custom limit and offset', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true, status: 200,
      body: { dataItems: [], pagingMetadata: { count: 0, total: 50 } },
    });

    await veloDataItemQuery(config, {
      dataCollectionId: 'Products',
      limit: 10,
      offset: 20,
    });

    expect(mockWixApiFetch).toHaveBeenCalledWith(
      config, 'POST', '/wix-data/v2/items/query',
      expect.objectContaining({
        query: expect.objectContaining({
          paging: { limit: 10, offset: 20 },
        }),
      }),
    );
  });

  it('clamps limit to max 100', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true, status: 200,
      body: { dataItems: [], pagingMetadata: { count: 0, total: 0 } },
    });

    await veloDataItemQuery(config, {
      dataCollectionId: 'Products',
      limit: 500,
    });

    expect(mockWixApiFetch).toHaveBeenCalledWith(
      config, 'POST', '/wix-data/v2/items/query',
      expect.objectContaining({
        query: expect.objectContaining({
          paging: expect.objectContaining({ limit: 100 }),
        }),
      }),
    );
  });

  it('returns readable text for empty results', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true, status: 200,
      body: { dataItems: [], pagingMetadata: { count: 0, total: 0 } },
    });

    const result = await veloDataItemQuery(config, { dataCollectionId: 'Empty' });
    expect(result).toContain('0 items');
  });

  it('returns ERROR on API failure', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: false, status: 403,
      body: { message: 'Insufficient permissions' },
    });

    const result = await veloDataItemQuery(config, { dataCollectionId: 'Products' });
    expect(result).toContain('ERROR');
    expect(result).toContain('403');
  });

  it('includes paging metadata in output', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true, status: 200,
      body: {
        dataItems: [{ _id: 'a', data: { x: 1 } }],
        pagingMetadata: { count: 1, total: 150 },
      },
    });

    const result = await veloDataItemQuery(config, { dataCollectionId: 'Products' });
    expect(result).toContain('1 items');
    expect(result).toContain('150');
  });
});
