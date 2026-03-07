import { runInDir } from '../lib/exec.js';
import type { VeloConfig } from '../lib/config.js';

/**
 * Run `wix dev` from the prod repo to start a local preview.
 * Captures and returns the preview URL from stdout.
 */
export async function veloPreview(config: VeloConfig): Promise<string> {
  const result = await runInDir(config.prodRepo, 'npx', ['wix', 'dev']);

  if (result.exitCode !== 0) {
    const detail = result.stderr.trim() || 'preview failed with no error output';
    return `ERROR: ${detail}`;
  }

  // Extract URL from output
  const urlMatch = result.stdout.match(/https?:\/\/\S+/);

  if (!urlMatch) {
    return 'ERROR: No preview URL found in output.';
  }

  return `Preview running at: ${urlMatch[0]}`;
}
