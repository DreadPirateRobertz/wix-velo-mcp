import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  veloCatalogImport,
  toWixProduct,
  type CatalogProduct,
} from '../src/tools/veloCatalogImport.js';

// ── toWixProduct ─────────────────────────────────────────────────────

const sampleProduct: CatalogProduct = {
  name: 'Monterey Futon Frame',
  slug: 'monterey',
  sku: 'CF-FRAME-MONTEREY',
  category: 'futon-frames',
  url: 'https://www.carolinafutons.com/product-page/monterey',
  price: 549,
  description: 'The Monterey features mission-style arms.',
  images: [
    'https://static.wixstatic.com/media/img1.jpg',
    'https://static.wixstatic.com/media/img2.jpg',
  ],
  variants: [
    { label: 'Full / Cherry', sku: null, price: null },
    { label: 'Queen / Cherry', sku: null, price: null },
  ],
  dimensions: { width: 80, depth: 40, height: 30, weight: 75 },
  manufacturer: 'Night & Day Furniture',
  inStock: true,
  bundleCompatible: true,
  availability: 'InStock',
  swatches: ['Cherry'],
  sizes: ['Full', 'Queen'],
};

describe('toWixProduct', () => {
  it('maps name, slug, sku, and description', () => {
    const wix = toWixProduct(sampleProduct);
    expect(wix.name).toBe('Monterey Futon Frame');
    expect(wix.slug).toBe('monterey');
    expect(wix.sku).toBe('CF-FRAME-MONTEREY');
    expect(wix.description).toBe('The Monterey features mission-style arms.');
  });

  it('sets productType to physical', () => {
    const wix = toWixProduct(sampleProduct);
    expect(wix.productType).toBe('physical');
  });

  it('maps price into priceData', () => {
    const wix = toWixProduct(sampleProduct);
    expect(wix.priceData).toEqual({
      currency: 'USD',
      price: 549,
    });
  });

  it('maps images into media.items', () => {
    const wix = toWixProduct(sampleProduct);
    expect(wix.media.items).toHaveLength(2);
    expect(wix.media.items[0]).toEqual({
      image: {
        url: 'https://static.wixstatic.com/media/img1.jpg',
        altText: 'Monterey Futon Frame',
      },
    });
  });

  it('maps weight', () => {
    const wix = toWixProduct(sampleProduct);
    expect(wix.weight).toBe(75);
  });

  it('sets visible based on availability', () => {
    const wix = toWixProduct(sampleProduct);
    expect(wix.visible).toBe(true);

    const outOfStock = { ...sampleProduct, availability: 'OutOfStock' };
    const wix2 = toWixProduct(outOfStock);
    expect(wix2.visible).toBe(true); // still visible, just out of stock
  });

  it('creates productOptions from sizes and swatches', () => {
    const wix = toWixProduct(sampleProduct);
    expect(wix.productOptions).toBeDefined();
    const sizeOpt = wix.productOptions!.find(
      (o: { name: string }) => o.name === 'Size',
    );
    expect(sizeOpt).toBeDefined();
    expect(sizeOpt!.choices).toHaveLength(2);
    expect(sizeOpt!.choices[0].value).toBe('Full');
    expect(sizeOpt!.choices[1].value).toBe('Queen');

    const finishOpt = wix.productOptions!.find(
      (o: { name: string }) => o.name === 'Finish',
    );
    expect(finishOpt).toBeDefined();
    expect(finishOpt!.choices).toHaveLength(1);
    expect(finishOpt!.choices[0].value).toBe('Cherry');
  });

  it('omits productOptions when no sizes or swatches', () => {
    const simple = {
      ...sampleProduct,
      sizes: undefined,
      swatches: undefined,
      variants: [],
    };
    const wix = toWixProduct(simple);
    expect(wix.productOptions).toBeUndefined();
  });

  it('handles empty images array', () => {
    const noImages = { ...sampleProduct, images: [] };
    const wix = toWixProduct(noImages);
    expect(wix.media.items).toHaveLength(0);
  });

  it('handles zero price', () => {
    const free = { ...sampleProduct, price: 0 };
    const wix = toWixProduct(free);
    expect(wix.priceData.price).toBe(0);
  });

  it('handles missing dimensions (all zero)', () => {
    const noDims = {
      ...sampleProduct,
      dimensions: { width: 0, depth: 0, height: 0, weight: 0 },
    };
    const wix = toWixProduct(noDims);
    expect(wix.weight).toBe(0);
  });
});

// ── veloCatalogImport ────────────────────────────────────────────────

// Mock fs and fetch
const mockReadFile = vi.fn();
vi.mock('node:fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('veloCatalogImport', () => {
  const wixConfig = {
    apiKey: 'test-api-key',
    siteId: 'test-site-id',
  };

  const minimalCatalog = {
    catalogVersion: '1.0.0',
    totalProducts: 1,
    categories: { 'futon-frames': 1 },
    products: [sampleProduct],
  };

  beforeEach(() => {
    mockReadFile.mockReset();
    mockFetch.mockReset();
  });

  it('returns error when catalog file not found', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));
    const result = await veloCatalogImport(wixConfig, {
      catalogPath: '/bad/path.json',
    });
    expect(result).toContain('ERROR');
    expect(result).toContain('catalog');
  });

  it('returns error when catalog JSON is invalid', async () => {
    mockReadFile.mockResolvedValue('not valid json {{{');
    const result = await veloCatalogImport(wixConfig, {
      catalogPath: '/fake/catalog.json',
    });
    expect(result).toContain('ERROR');
    expect(result).toContain('parse');
  });

  it('returns error when catalog has no products array', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ catalogVersion: '1.0.0' }));
    const result = await veloCatalogImport(wixConfig, {
      catalogPath: '/fake/catalog.json',
    });
    expect(result).toContain('ERROR');
    expect(result).toContain('products');
  });

  it('returns error when catalog products array is empty', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ ...minimalCatalog, products: [], totalProducts: 0 }),
    );
    const result = await veloCatalogImport(wixConfig, {
      catalogPath: '/fake/catalog.json',
    });
    expect(result).toContain('ERROR');
    expect(result).toContain('empty');
  });

  it('dry run does not call API', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(minimalCatalog));
    const result = await veloCatalogImport(wixConfig, {
      catalogPath: '/fake/catalog.json',
      dryRun: true,
    });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toContain('DRY RUN');
    expect(result).toContain('1 product');
  });

  it('dry run shows product names', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(minimalCatalog));
    const result = await veloCatalogImport(wixConfig, {
      catalogPath: '/fake/catalog.json',
      dryRun: true,
    });
    expect(result).toContain('Monterey Futon Frame');
  });

  it('calls Wix API with correct headers and body', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(minimalCatalog));
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          product: { id: 'wix-123', name: 'Monterey Futon Frame' },
        }),
    });

    await veloCatalogImport(wixConfig, {
      catalogPath: '/fake/catalog.json',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://www.wixapis.com/stores/v1/products');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Authorization']).toBe('test-api-key');
    expect(opts.headers['wix-site-id']).toBe('test-site-id');
    expect(opts.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(opts.body);
    expect(body.product.name).toBe('Monterey Futon Frame');
  });

  it('reports success count on all successful imports', async () => {
    const twoProd = {
      ...minimalCatalog,
      totalProducts: 2,
      products: [
        sampleProduct,
        { ...sampleProduct, name: 'Venice Frame', slug: 'venice', sku: 'CF-VENICE' },
      ],
    };
    mockReadFile.mockResolvedValue(JSON.stringify(twoProd));
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ product: { id: 'wix-1' } }),
    });

    const result = await veloCatalogImport(wixConfig, {
      catalogPath: '/fake/catalog.json',
    });
    expect(result).toContain('2 succeeded');
    expect(result).toContain('0 failed');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('reports partial failures with product names', async () => {
    const twoProd = {
      ...minimalCatalog,
      totalProducts: 2,
      products: [
        sampleProduct,
        { ...sampleProduct, name: 'Venice Frame', slug: 'venice', sku: 'CF-VENICE' },
      ],
    };
    mockReadFile.mockResolvedValue(JSON.stringify(twoProd));
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ product: { id: 'wix-1' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ message: 'Product already exists' }),
      });

    const result = await veloCatalogImport(wixConfig, {
      catalogPath: '/fake/catalog.json',
    });
    expect(result).toContain('1 succeeded');
    expect(result).toContain('1 failed');
    expect(result).toContain('Venice Frame');
  });

  it('reports all failures on total API failure', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(minimalCatalog));
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Unauthorized' }),
    });

    const result = await veloCatalogImport(wixConfig, {
      catalogPath: '/fake/catalog.json',
    });
    expect(result).toContain('0 succeeded');
    expect(result).toContain('1 failed');
  });

  it('handles fetch network error gracefully', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(minimalCatalog));
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await veloCatalogImport(wixConfig, {
      catalogPath: '/fake/catalog.json',
    });
    expect(result).toContain('failed');
    expect(result).toContain('Monterey Futon Frame');
  });

  it('handles API returning non-JSON error response', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(minimalCatalog));
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    });

    const result = await veloCatalogImport(wixConfig, {
      catalogPath: '/fake/catalog.json',
    });
    expect(result).toContain('failed');
  });

  it('filters by category when specified', async () => {
    const multiCat = {
      ...minimalCatalog,
      totalProducts: 2,
      products: [
        sampleProduct,
        {
          ...sampleProduct,
          name: 'Platform Bed',
          slug: 'platform',
          sku: 'CF-BED',
          category: 'platform-beds',
        },
      ],
    };
    mockReadFile.mockResolvedValue(JSON.stringify(multiCat));
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ product: { id: 'wix-1' } }),
    });

    const result = await veloCatalogImport(wixConfig, {
      catalogPath: '/fake/catalog.json',
      category: 'platform-beds',
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.product.name).toBe('Platform Bed');
    expect(result).toContain('1');
  });

  it('returns error when category filter matches no products', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(minimalCatalog));
    const result = await veloCatalogImport(wixConfig, {
      catalogPath: '/fake/catalog.json',
      category: 'nonexistent-category',
    });
    expect(result).toContain('ERROR');
    expect(result).toContain('nonexistent-category');
  });
});
