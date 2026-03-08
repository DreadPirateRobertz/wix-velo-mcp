import { describe, it, expect, vi, beforeEach } from 'vitest';
import { veloDataItemUpdate } from '../src/tools/veloDataItemUpdate.js';
import type { VeloConfig } from '../src/lib/config.js';

const mockWixApiFetch = vi.fn();
const mockValidateWixApiConfig = vi.fn();

vi.mock('../src/lib/wixApi.js', () => ({
  wixApiFetch: (...args: unknown[]) => mockWixApiFetch(...args),
  validateWixApiConfig: (...args: unknown[]) => mockValidateWixApiConfig(...args),
}));

describe('veloDataItemUpdate', () => {
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
    mockValidateWixApiConfig.mockReturnValue('ERROR: WIX_SITE_ID missing');

    const result = await veloDataItemUpdate(config, {
      dataCollectionId: 'Products',
      itemId: 'abc',
      data: { name: 'Updated' },
    });
    expect(result).toContain('ERROR');
    expect(mockWixApiFetch).not.toHaveBeenCalled();
  });

  it('returns ERROR when dataCollectionId is empty', async () => {
    const result = await veloDataItemUpdate(config, {
      dataCollectionId: '',
      itemId: 'abc',
      data: { name: 'Updated' },
    });
    expect(result).toContain('ERROR');
    expect(result).toContain('dataCollectionId');
  });

  it('returns ERROR when itemId is empty', async () => {
    const result = await veloDataItemUpdate(config, {
      dataCollectionId: 'Products',
      itemId: '',
      data: { name: 'Updated' },
    });
    expect(result).toContain('ERROR');
    expect(result).toContain('itemId');
  });

  it('returns ERROR when data is empty', async () => {
    const result = await veloDataItemUpdate(config, {
      dataCollectionId: 'Products',
      itemId: 'abc',
      data: {},
    });
    expect(result).toContain('ERROR');
    expect(result).toContain('data');
  });

  it('updates an item successfully', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true, status: 200,
      body: {
        dataItem: { _id: 'abc', data: { name: 'Updated Futon', price: 349 } },
      },
    });

    const result = await veloDataItemUpdate(config, {
      dataCollectionId: 'Products',
      itemId: 'abc',
      data: { name: 'Updated Futon', price: 349 },
    });

    expect(result).toContain('abc');
    expect(result).toContain('successfully');
    expect(mockWixApiFetch).toHaveBeenCalledWith(
      config, 'PUT', '/wix-data/v2/items/abc',
      {
        dataCollectionId: 'Products',
        dataItem: { _id: 'abc', data: { name: 'Updated Futon', price: 349 } },
      },
    );
  });

  it('returns ERROR when item not found', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: false, status: 404,
      body: { message: 'Item not found' },
    });

    const result = await veloDataItemUpdate(config, {
      dataCollectionId: 'Products',
      itemId: 'nonexistent',
      data: { name: 'Ghost' },
    });
    expect(result).toContain('ERROR');
    expect(result).toContain('404');
  });

  it('returns ERROR on API failure', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: false, status: 500,
      body: { message: 'Internal server error' },
    });

    const result = await veloDataItemUpdate(config, {
      dataCollectionId: 'Products',
      itemId: 'abc',
      data: { name: 'Test' },
    });
    expect(result).toContain('ERROR');
    expect(result).toContain('500');
  });
});
