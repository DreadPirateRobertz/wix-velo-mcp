export interface VeloConfig {
  devRepo: string;
  prodRepo: string;
}

/**
 * Read configuration from environment variables.
 * @throws if required env vars are missing or empty
 */
export function getConfig(): VeloConfig {
  const devRepo = (process.env.VELO_DEV_REPO || '').trim();
  const prodRepo = (process.env.VELO_PROD_REPO || '').trim();

  if (!devRepo) {
    throw new Error('VELO_DEV_REPO environment variable is required');
  }
  if (!prodRepo) {
    throw new Error('VELO_PROD_REPO environment variable is required');
  }

  return { devRepo, prodRepo };
}
