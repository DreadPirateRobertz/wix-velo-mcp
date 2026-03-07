import { runInDir } from '../lib/exec.js';
import type { VeloConfig } from '../lib/config.js';

/**
 * Publish the Wix site from the prod repo.
 * Pre-checks: clean worktree and passing tests.
 * Then runs `npx wix publish --source local -y`.
 */
export async function veloPublish(config: VeloConfig): Promise<string> {
  const { prodRepo } = config;

  // ── Check clean worktree ───────────────────────────────────────────
  const status = await runInDir(prodRepo, 'git', ['status', '--porcelain']);
  if (status.stdout.trim()) {
    return `ERROR: Worktree is dirty. Commit or stash changes first.\n${status.stdout.trim()}`;
  }

  // ── Run tests ──────────────────────────────────────────────────────
  const tests = await runInDir(prodRepo, 'npm', ['test']);
  if (tests.exitCode !== 0) {
    const detail = tests.stderr.trim() || tests.stdout.trim() || 'unknown failure';
    return `ERROR: Tests failed. Fix before publishing.\n${detail}`;
  }

  // ── Publish ────────────────────────────────────────────────────────
  const publish = await runInDir(prodRepo, 'npx', [
    'wix', 'publish', '--source', 'local', '-y',
  ]);

  if (publish.exitCode !== 0) {
    const detail = publish.stderr.trim() || 'publish failed with no error output';
    return `ERROR: ${detail}`;
  }

  return publish.stdout.trim() || 'Published successfully.';
}
