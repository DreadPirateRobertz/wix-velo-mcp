import { describe, it, expect, vi, beforeEach } from 'vitest';
import { veloCmsCreate } from '../src/tools/veloCmsCreate.js';
import type { VeloConfig } from '../src/lib/config.js';

const mockWixApiFetch = vi.fn();
const mockValidateWixApiConfig = vi.fn();

vi.mock('../src/lib/wixApi.js', () => ({
  wixApiFetch: (...args: unknown[]) => mockWixApiFetch(...args),
  validateWixApiConfig: (...args: unknown[]) => mockValidateWixApiConfig(...args),
}));

describe('veloCmsCreate', () => {
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

    const result = await veloCmsCreate(config, {
      collectionId: 'TestItems',
      displayName: 'Test Items',
    });
    expect(result).toContain('ERROR');
    expect(result).toContain('WIX_API_KEY');
    expect(mockWixApiFetch).not.toHaveBeenCalled();
  });

  it('creates a collection with id and displayName', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: { collection: { id: 'TestItems', displayName: 'Test Items' } },
    });

    const result = await veloCmsCreate(config, {
      collectionId: 'TestItems',
      displayName: 'Test Items',
    });

    expect(result).toContain('TestItems');
    expect(result).toContain('Created');
    expect(mockWixApiFetch).toHaveBeenCalledWith(
      config,
      'POST',
      '/wix-data/v2/collections',
      expect.objectContaining({
        collection: expect.objectContaining({
          id: 'TestItems',
          displayName: 'Test Items',
        }),
      }),
    );
  });

  it('passes fields when provided', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: { collection: { id: 'Products', displayName: 'Products' } },
    });

    const fields = [
      { key: 'name', displayName: 'Name', type: 'TEXT' },
      { key: 'price', displayName: 'Price', type: 'NUMBER' },
    ];

    await veloCmsCreate(config, {
      collectionId: 'Products',
      displayName: 'Products',
      fields,
    });

    const callArgs = mockWixApiFetch.mock.calls[0];
    const body = callArgs[3] as Record<string, unknown>;
    const coll = body.collection as Record<string, unknown>;
    expect(coll.fields).toEqual(fields);
  });

  it('passes permissions when provided', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: { collection: { id: 'Items', displayName: 'Items' } },
    });

    const permissions = {
      insert: 'ADMIN',
      update: 'ADMIN',
      remove: 'ADMIN',
      read: 'ANYONE',
    };

    await veloCmsCreate(config, {
      collectionId: 'Items',
      displayName: 'Items',
      permissions,
    });

    const callArgs = mockWixApiFetch.mock.calls[0];
    const body = callArgs[3] as Record<string, unknown>;
    const coll = body.collection as Record<string, unknown>;
    expect(coll.permissions).toEqual(permissions);
  });

  it('returns ERROR on API failure with message', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: false,
      status: 409,
      body: { message: 'Collection already exists' },
    });

    const result = await veloCmsCreate(config, {
      collectionId: 'Existing',
      displayName: 'Existing',
    });

    expect(result).toContain('ERROR');
    expect(result).toContain('409');
    expect(result).toContain('Collection already exists');
  });

  it('returns ERROR on network failure', async () => {
    mockWixApiFetch.mockResolvedValue({
      ok: false,
      status: 0,
      body: { error: 'ECONNREFUSED' },
    });

    const result = await veloCmsCreate(config, {
      collectionId: 'Test',
      displayName: 'Test',
    });

    expect(result).toContain('ERROR');
  });

  it('requires collectionId to be non-empty', async () => {
    const result = await veloCmsCreate(config, {
      collectionId: '',
      displayName: 'Test',
    });

    expect(result).toContain('ERROR');
    expect(result).toContain('collectionId');
    expect(mockWixApiFetch).not.toHaveBeenCalled();
  });

  it('requires displayName to be non-empty', async () => {
    const result = await veloCmsCreate(config, {
      collectionId: 'Test',
      displayName: '',
    });

    expect(result).toContain('ERROR');
    expect(result).toContain('displayName');
    expect(mockWixApiFetch).not.toHaveBeenCalled();
  });
});
