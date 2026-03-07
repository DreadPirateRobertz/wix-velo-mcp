import { runInDir } from '../lib/exec.js';
import { isValidTag } from '../lib/tags.js';
import type { VeloConfig } from '../lib/config.js';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

export { isValidTag };

/**
 * Show what would change if the prod repo were synced to a given tag
 * of the dev repo, using rsync --dry-run --itemize-changes.
 *
 * If no tag is provided, the latest tag in the dev repo is used.
 */
export async function veloDiff(
  config: VeloConfig,
  input: { tag?: string },
): Promise<string> {
  const { devRepo, prodRepo } = config;

  // ── Resolve tag ────────────────────────────────────────────────────
  let tag = input.tag;

  if (tag) {
    // Validate explicit tag
    if (!isValidTag(tag)) {
      return `ERROR: "${tag}" is not a valid release tag (expected vX.Y.Z)`;
    }
  } else {
    // Auto-detect latest tag
    const descResult = await runInDir(
      devRepo,
      'git',
      ['describe', '--tags', '--abbrev=0'],
    );
    if (descResult.exitCode !== 0 || !descResult.stdout.trim()) {
      return 'ERROR: No tags found in dev repo. Cannot determine latest release.';
    }
    tag = descResult.stdout.trim();
    if (!isValidTag(tag)) {
      return `ERROR: Latest tag "${tag}" is not a valid release tag (expected vX.Y.Z)`;
    }
  }

  // ── Verify tag exists ──────────────────────────────────────────────
  const tagCheck = await runInDir(devRepo, 'git', ['tag', '-l', tag]);
  if (!tagCheck.stdout.trim()) {
    return `ERROR: Tag "${tag}" not found in dev repo.`;
  }

  // ── Create temporary worktree ──────────────────────────────────────
  const worktreeId = randomBytes(4).toString('hex');
  const worktreePath = join(devRepo, `../.velo-diff-${worktreeId}`);

  const wtAdd = await runInDir(devRepo, 'git', [
    'worktree',
    'add',
    '--detach',
    worktreePath,
    tag,
  ]);

  if (wtAdd.exitCode !== 0) {
    return `ERROR: Failed to checkout tag "${tag}": ${wtAdd.stderr}`;
  }

  try {
    // ── rsync dry-run ──────────────────────────────────────────────
    const rsyncResult = await runInDir(worktreePath, 'rsync', [
      '--dry-run',
      '--itemize-changes',
      '--recursive',
      '--exclude',
      '.git',
      `${prodRepo}/`,
      './',
    ]);

    if (rsyncResult.exitCode !== 0) {
      return `ERROR: rsync failed (exit ${rsyncResult.exitCode}): ${rsyncResult.stderr || rsyncResult.stdout}`;
    }

    const changes = rsyncResult.stdout.trim();

    if (!changes) {
      return `No differences between prod and ${tag}.`;
    }

    return `Changes if synced to ${tag}:\n${changes}`;
  } finally {
    // ── Cleanup worktree ───────────────────────────────────────────
    const cleanup = await runInDir(devRepo, 'git', [
      'worktree',
      'remove',
      '--force',
      worktreePath,
    ]);
    if (cleanup.exitCode !== 0) {
      console.error(`[veloDiff] Worktree cleanup failed for ${worktreePath}: ${cleanup.stderr}`);
    }
  }
}
