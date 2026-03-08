import { describe, it, expect, vi, beforeEach } from 'vitest';
import { veloCmsRead } from '../src/tools/veloCmsRead.js';
import type { VeloConfig } from '../src/lib/config.js';

const mockWixApiFetch = vi.fn();
const mockValidateWixApiConfig = vi.fn();

vi.mock('../src/lib/wixApi.js', () => ({
  wixApiFetch: (...args: unknown[]) => mockWixApiFetch(...args),
  validateWixApiConfig: (...args: unknown[]) => mockValidateWixApiConfig(...args),
}));

describe('veloCmsRead', () => {
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

    const result = await veloCmsRead(config, { collectionId: 'Test' });
    expect(result).toContain('ERROR');
    expect(mockWixApiFetch).not.toHaveBeenCalled();
  });

  it('reads a specific collection by ID', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        collection: {
          id: 'Products',
          displayName: 'Products',
          fields: [
            { key: 'name', displayName: 'Name', type: 'TEXT' },
            { key: 'price', displayName: 'Price', type: 'NUMBER' },
          ],
        },
      },
    });

    const result = await veloCmsRead(config, { collectionId: 'Products' });

    expect(result).toContain('Products');
    expect(result).toContain('name');
    expect(result).toContain('TEXT');
    expect(mockWixApiFetch).toHaveBeenCalledWith(
      config, 'GET', '/wix-data/v2/collections/Products',
    );
  });

  it('lists all collections when no collectionId provided', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        collections: [
          { id: 'Products', displayName: 'Products' },
          { id: 'Orders', displayName: 'Orders' },
        ],
      },
    });

    const result = await veloCmsRead(config, {});

    expect(result).toContain('Products');
    expect(result).toContain('Orders');
    expect(mockWixApiFetch).toHaveBeenCalledWith(
      config, 'GET', '/wix-data/v2/collections',
    );
  });

  it('returns ERROR on 404', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: false,
      status: 404,
      body: { message: 'Collection not found' },
    });

    const result = await veloCmsRead(config, { collectionId: 'Missing' });

    expect(result).toContain('ERROR');
    expect(result).toContain('404');
  });

  it('returns ERROR on network failure', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: false,
      status: 0,
      body: { error: 'fetch failed' },
    });

    const result = await veloCmsRead(config, { collectionId: 'Test' });
    expect(result).toContain('ERROR');
  });

  it('formats collection details as readable text', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        collection: {
          id: 'Reviews',
          displayName: 'Customer Reviews',
          fields: [
            { key: 'rating', displayName: 'Rating', type: 'NUMBER' },
            { key: 'comment', displayName: 'Comment', type: 'TEXT' },
          ],
          permissions: { read: 'ANYONE', insert: 'MEMBER', update: 'ADMIN', remove: 'ADMIN' },
        },
      },
    });

    const result = await veloCmsRead(config, { collectionId: 'Reviews' });

    expect(result).toContain('Customer Reviews');
    expect(result).toContain('rating');
    expect(result).toContain('NUMBER');
    expect(result).toContain('ANYONE');
  });

  it('handles collection with no fields', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        collection: {
          id: 'Empty',
          displayName: 'Empty Collection',
        },
      },
    });

    const result = await veloCmsRead(config, { collectionId: 'Empty' });
    expect(result).toContain('Empty Collection');
    expect(result).not.toContain('ERROR');
  });
});
