import { describe, it, expect, vi, beforeEach } from 'vitest';
import { veloCmsUpdate } from '../src/tools/veloCmsUpdate.js';
import type { VeloConfig } from '../src/lib/config.js';

const mockWixApiFetch = vi.fn();
const mockValidateWixApiConfig = vi.fn();

vi.mock('../src/lib/wixApi.js', () => ({
  wixApiFetch: (...args: unknown[]) => mockWixApiFetch(...args),
  validateWixApiConfig: (...args: unknown[]) => mockValidateWixApiConfig(...args),
}));

describe('veloCmsUpdate', () => {
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

    const result = await veloCmsUpdate(config, {
      collectionId: 'Test',
    });
    expect(result).toContain('ERROR');
    expect(mockWixApiFetch).not.toHaveBeenCalled();
  });

  it('requires collectionId to be non-empty', async () => {
    const result = await veloCmsUpdate(config, { collectionId: '' });

    expect(result).toContain('ERROR');
    expect(result).toContain('collectionId');
    expect(mockWixApiFetch).not.toHaveBeenCalled();
  });

  it('updates collection displayName', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: { collection: { id: 'Products', displayName: 'All Products' } },
    });

    const result = await veloCmsUpdate(config, {
      collectionId: 'Products',
      displayName: 'All Products',
    });

    expect(result).toContain('Updated');
    expect(result).toContain('Products');
    expect(mockWixApiFetch).toHaveBeenCalledWith(
      config,
      'PATCH',
      '/wix-data/v2/collections/Products',
      expect.objectContaining({
        collection: expect.objectContaining({
          displayName: 'All Products',
        }),
      }),
    );
  });

  it('adds new fields to collection', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: { collection: { id: 'Products', displayName: 'Products' } },
    });

    const fields = [
      { key: 'color', displayName: 'Color', type: 'TEXT' },
    ];

    await veloCmsUpdate(config, {
      collectionId: 'Products',
      fields,
    });

    const callArgs = mockWixApiFetch.mock.calls[0];
    const body = callArgs[3] as Record<string, unknown>;
    const coll = body.collection as Record<string, unknown>;
    expect(coll.fields).toEqual(fields);
  });

  it('updates collection permissions', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: { collection: { id: 'Items', displayName: 'Items' } },
    });

    const permissions = { read: 'ANYONE', insert: 'MEMBER', update: 'MEMBER', remove: 'ADMIN' };

    await veloCmsUpdate(config, {
      collectionId: 'Items',
      permissions,
    });

    const callArgs = mockWixApiFetch.mock.calls[0];
    const body = callArgs[3] as Record<string, unknown>;
    const coll = body.collection as Record<string, unknown>;
    expect(coll.permissions).toEqual(permissions);
  });

  it('returns ERROR on API failure', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: false,
      status: 400,
      body: { message: 'Invalid field type' },
    });

    const result = await veloCmsUpdate(config, {
      collectionId: 'Products',
      displayName: 'X',
    });

    expect(result).toContain('ERROR');
    expect(result).toContain('400');
    expect(result).toContain('Invalid field type');
  });

  it('returns ERROR on network failure', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: false,
      status: 0,
      body: { error: 'ETIMEDOUT' },
    });

    const result = await veloCmsUpdate(config, {
      collectionId: 'Products',
      displayName: 'X',
    });

    expect(result).toContain('ERROR');
  });

  it('returns ERROR when no update fields provided', async () => {
    const result = await veloCmsUpdate(config, {
      collectionId: 'Products',
    });

    expect(result).toContain('ERROR');
    expect(result).toContain('at least one');
    expect(mockWixApiFetch).not.toHaveBeenCalled();
  });
});
