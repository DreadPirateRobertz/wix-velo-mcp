import { describe, it, expect, vi, beforeEach } from 'vitest';
import { veloDataItemList } from '../src/tools/veloDataItemList.js';
import type { VeloConfig } from '../src/lib/config.js';

const mockWixApiFetch = vi.fn();
const mockValidateWixApiConfig = vi.fn();

vi.mock('../src/lib/wixApi.js', () => ({
  wixApiFetch: (...args: unknown[]) => mockWixApiFetch(...args),
  validateWixApiConfig: (...args: unknown[]) => mockValidateWixApiConfig(...args),
}));

describe('veloDataItemList', () => {
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

    const result = await veloDataItemList(config, { dataCollectionId: 'Products' });
    expect(result).toContain('ERROR');
    expect(mockWixApiFetch).not.toHaveBeenCalled();
  });

  it('returns ERROR when dataCollectionId is empty', async () => {
    const result = await veloDataItemList(config, { dataCollectionId: '' });
    expect(result).toContain('ERROR');
    expect(result).toContain('dataCollectionId');
  });

  it('lists items with default paging', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true, status: 200,
      body: {
        dataItems: [
          { _id: 'item1', data: { name: 'Futon A' } },
          { _id: 'item2', data: { name: 'Futon B' } },
        ],
        pagingMetadata: { count: 2, total: 2 },
      },
    });

    const result = await veloDataItemList(config, { dataCollectionId: 'Products' });

    expect(result).toContain('2 items');
    expect(result).toContain('item1');
    expect(result).toContain('Futon A');
    expect(mockWixApiFetch).toHaveBeenCalledWith(
      config, 'POST', '/wix-data/v2/items/query',
      expect.objectContaining({
        dataCollectionId: 'Products',
        query: { paging: { limit: 50, offset: 0 } },
      }),
    );
  });

  it('respects custom limit', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true, status: 200,
      body: { dataItems: [], pagingMetadata: { count: 0, total: 0 } },
    });

    await veloDataItemList(config, { dataCollectionId: 'Products', limit: 10 });

    expect(mockWixApiFetch).toHaveBeenCalledWith(
      config, 'POST', '/wix-data/v2/items/query',
      expect.objectContaining({
        query: { paging: { limit: 10, offset: 0 } },
      }),
    );
  });

  it('returns readable text for empty collection', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true, status: 200,
      body: { dataItems: [], pagingMetadata: { count: 0, total: 0 } },
    });

    const result = await veloDataItemList(config, { dataCollectionId: 'Empty' });
    expect(result).toContain('0 items');
  });

  it('returns ERROR on API failure', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: false, status: 404,
      body: { message: 'Collection not found' },
    });

    const result = await veloDataItemList(config, { dataCollectionId: 'Nope' });
    expect(result).toContain('ERROR');
    expect(result).toContain('404');
  });

  it('formats items as JSON for readability', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true, status: 200,
      body: {
        dataItems: [
          { _id: 'x1', data: { title: 'Test Item', status: 'active' } },
        ],
        pagingMetadata: { count: 1, total: 1 },
      },
    });

    const result = await veloDataItemList(config, { dataCollectionId: 'Items' });
    expect(result).toContain('x1');
    expect(result).toContain('Test Item');
  });
});
