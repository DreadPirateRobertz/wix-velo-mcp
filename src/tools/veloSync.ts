import { runInDir } from '../lib/exec.js';
import { isValidTag } from '../lib/tags.js';
import type { VeloConfig } from '../lib/config.js';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

export { isValidTag };

/** Files/dirs to copy from dev to prod */
const SYNC_INCLUDES = ['src/', 'tests/', 'package.json', 'vitest.config.js'];

/**
 * Sync a tagged release from dev repo to production repo.
 * Only accepts semver release tags (v0.0.0, v1.2.3, etc).
 * Checks out the tag via worktree, copies relevant files, commits as 'release: <tag>'.
 * Returns ERROR and skips commit/push if any subprocess (rm, cp, git add, commit) fails.
 */
export async function veloSync(
  config: VeloConfig,
  input: { tag: string },
): Promise<string> {
  const { tag } = input;

  if (!isValidTag(tag)) {
    return `ERROR: "${tag}" is not a valid release tag. Must match v{major}.{minor}.{patch} (e.g., v0.0.0, v1.2.3). Only tagged releases can be synced to production.`;
  }

  // Verify tag exists in dev repo
  const tagCheck = await runInDir(config.devRepo, 'git', ['tag', '-l', tag]);
  if (tagCheck.stdout.trim() !== tag) {
    return `ERROR: Tag "${tag}" not found in dev repo at ${config.devRepo}`;
  }

  // Create a temporary worktree adjacent to devRepo (not /tmp/)
  const worktreeId = randomBytes(4).toString('hex');
  const worktreePath = join(config.devRepo, `../.velo-sync-${worktreeId}`);
  const worktree = await runInDir(config.devRepo, 'git', [
    'worktree', 'add', '--detach', worktreePath, tag,
  ]);
  if (worktree.exitCode !== 0) {
    return `ERROR: Failed to checkout tag ${tag}: ${worktree.stderr}`;
  }

  try {
    // Clean prod repo src/ and tests/ — check exit code
    const rmResult = await runInDir(config.prodRepo, 'rm', ['-rf', 'src/', 'tests/']);
    if (rmResult.exitCode !== 0) {
      return `ERROR: Failed to rm prod files: ${rmResult.stderr}`;
    }

    // Copy each included path — check exit code on each
    for (const item of SYNC_INCLUDES) {
      const cpArgs = item.endsWith('/')
        ? ['-r', item, `${config.prodRepo}/${item}`]
        : [item, `${config.prodRepo}/${item}`];
      const cpResult = await runInDir(worktreePath, 'cp', cpArgs);
      if (cpResult.exitCode !== 0) {
        return `ERROR: Failed to copy "${item}": ${cpResult.stderr}`;
      }
    }

    // Stage, diff, commit
    const stage = await runInDir(config.prodRepo, 'git', ['add', '-A']);
    if (stage.exitCode !== 0) {
      return `ERROR: Failed to stage changes: ${stage.stderr}`;
    }
    const diff = await runInDir(config.prodRepo, 'git', ['diff', '--cached', '--stat']);

    if (diff.stdout.trim() === '') {
      return `No changes to sync — production repo already matches ${tag}`;
    }

    const commit = await runInDir(config.prodRepo, 'git', [
      'commit', '-m', `release: ${tag}`,
    ]);

    if (commit.exitCode !== 0) {
      return `ERROR: Failed to commit: ${commit.stderr}`;
    }

    // Push to remote
    const push = await runInDir(config.prodRepo, 'git', ['push']);
    const pushStatus = push.exitCode === 0
      ? 'Pushed to remote.'
      : `WARNING: Push failed: ${push.stderr}`;

    return `Synced ${tag} to production repo.\n\n${diff.stdout.trim()}\n\n${pushStatus}`;
  } finally {
    // Clean up worktree
    const cleanup = await runInDir(config.devRepo, 'git', ['worktree', 'remove', '--force', worktreePath]);
    if (cleanup.exitCode !== 0) {
      console.error(`[veloSync] Worktree cleanup failed for ${worktreePath}: ${cleanup.stderr}`);
    }
  }
}
