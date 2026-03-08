import { readFile } from 'node:fs/promises';

export interface CatalogProduct {
  name: string;
  slug: string;
  sku: string;
  category: string;
  url: string;
  price: number;
  description: string;
  images: string[];
  variants: { label: string; sku: string | null; price: number | null }[];
  dimensions: { width: number; depth: number; height: number; weight: number };
  manufacturer: string;
  inStock: boolean;
  bundleCompatible: boolean;
  availability: string;
  swatches?: string[];
  sizes?: string[];
}

interface CatalogFile {
  catalogVersion: string;
  totalProducts: number;
  categories: Record<string, number>;
  products: CatalogProduct[];
}

interface WixConfig {
  apiKey: string;
  siteId: string;
}

interface WixMediaItem {
  image: { url: string; altText: string };
}

interface WixProductOption {
  optionType: string;
  name: string;
  choices: { value: string; description: string; inStock: boolean; visible: boolean }[];
}

interface WixProduct {
  name: string;
  slug: string;
  sku: string;
  description: string;
  productType: string;
  priceData: { currency: string; price: number };
  media: { items: WixMediaItem[] };
  weight: number;
  visible: boolean;
  productOptions?: WixProductOption[];
}

interface ImportInput {
  catalogPath: string;
  dryRun?: boolean;
  category?: string;
}

const WIX_PRODUCTS_API = 'https://www.wixapis.com/stores/v1/products';

/**
 * Transform a catalog-MASTER.json product to Wix Stores API format.
 */
export function toWixProduct(product: CatalogProduct): WixProduct {
  const wix: WixProduct = {
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description,
    productType: 'physical',
    priceData: {
      currency: 'USD',
      price: product.price,
    },
    media: {
      items: product.images.map((url) => ({
        image: { url, altText: product.name },
      })),
    },
    weight: product.dimensions.weight,
    visible: true,
  };

  const options: WixProductOption[] = [];

  if (product.sizes && product.sizes.length > 0) {
    options.push({
      optionType: 'drop_down',
      name: 'Size',
      choices: product.sizes.map((s) => ({
        value: s,
        description: s,
        inStock: true,
        visible: true,
      })),
    });
  }

  if (product.swatches && product.swatches.length > 0) {
    options.push({
      optionType: 'drop_down',
      name: 'Finish',
      choices: product.swatches.map((s) => ({
        value: s,
        description: s,
        inStock: true,
        visible: true,
      })),
    });
  }

  if (options.length > 0) {
    wix.productOptions = options;
  }

  return wix;
}

/**
 * Import products from catalog-MASTER.json to Wix Stores via REST API.
 */
export async function veloCatalogImport(
  config: WixConfig,
  input: ImportInput,
): Promise<string> {
  const { catalogPath, dryRun = false, category } = input;

  // Read and parse catalog file
  let raw: string;
  try {
    raw = await readFile(catalogPath, 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `ERROR: Failed to read catalog file at "${catalogPath}": ${msg}`;
  }

  let catalog: CatalogFile;
  try {
    catalog = JSON.parse(raw) as CatalogFile;
  } catch {
    return `ERROR: Failed to parse catalog JSON — check file format`;
  }

  if (!Array.isArray(catalog.products)) {
    return `ERROR: Catalog missing "products" array`;
  }

  let products = catalog.products;

  // Filter by category if specified
  if (category) {
    products = products.filter((p) => p.category === category);
    if (products.length === 0) {
      return `ERROR: No products found for category "${category}"`;
    }
  }

  if (products.length === 0) {
    return `ERROR: Catalog is empty — no products to import`;
  }

  // Dry run — just report what would happen
  if (dryRun) {
    const names = products.map((p) => `  - ${p.name} (${p.sku})`).join('\n');
    return `DRY RUN: Would import ${products.length} product${products.length === 1 ? '' : 's'}:\n${names}`;
  }

  // Import each product
  const succeeded: string[] = [];
  const failed: { name: string; error: string }[] = [];

  for (const product of products) {
    const wixProduct = toWixProduct(product);

    try {
      const response = await fetch(WIX_PRODUCTS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: config.apiKey,
          'wix-site-id': config.siteId,
        },
        body: JSON.stringify({ product: wixProduct }),
      });

      if (response.ok) {
        succeeded.push(product.name);
      } else {
        let errorMsg = `HTTP ${response.status}`;
        try {
          const errBody = await response.json();
          if (errBody.message) errorMsg += `: ${errBody.message}`;
        } catch {
          // non-JSON error response
        }
        failed.push({ name: product.name, error: errorMsg });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push({ name: product.name, error: msg });
    }
  }

  // Build summary
  const lines: string[] = [];
  lines.push(
    `Import complete: ${succeeded.length} succeeded, ${failed.length} failed (${products.length} total)`,
  );

  if (failed.length > 0) {
    lines.push('\nFailed products:');
    for (const f of failed) {
      lines.push(`  - ${f.name}: ${f.error}`);
    }
  }

  if (succeeded.length > 0 && succeeded.length <= 10) {
    lines.push('\nCreated:');
    for (const name of succeeded) {
      lines.push(`  - ${name}`);
    }
  }

  return lines.join('\n');
}
