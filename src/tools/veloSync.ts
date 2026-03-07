import { runInDir } from '../lib/exec.js';
import type { VeloConfig } from '../lib/config.js';

const TAG_PATTERN = /^v\d+\.\d+\.\d+$/;

/**
 * Validate that a ref looks like a semver release tag.
 */
export function isValidTag(tag: string): boolean {
  return TAG_PATTERN.test(tag);
}

/** Files/dirs to copy from dev to prod */
const SYNC_INCLUDES = ['src/', 'tests/', 'package.json', 'vitest.config.js'];

/**
 * Sync a tagged release from dev repo to production repo.
 * Only accepts semver release tags (v0.0.0, v1.2.3, etc).
 * Checks out the tag via worktree, copies relevant files, commits as 'release: <tag>'.
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

  // Create a temporary worktree to checkout the tag
  const tmpDir = `/tmp/velo-sync-${tag}-${Date.now()}`;
  const worktree = await runInDir(config.devRepo, 'git', [
    'worktree', 'add', '--detach', tmpDir, tag,
  ]);
  if (worktree.exitCode !== 0) {
    return `ERROR: Failed to checkout tag ${tag}: ${worktree.stderr}`;
  }

  try {
    // Clean prod repo src/ and tests/ (keep wix.config.json, .git, node_modules)
    await runInDir(config.prodRepo, 'rm', ['-rf', 'src/', 'tests/']);

    // Copy each included path
    for (const item of SYNC_INCLUDES) {
      if (item.endsWith('/')) {
        await runInDir(tmpDir, 'cp', ['-r', item, `${config.prodRepo}/${item}`]);
      } else {
        await runInDir(tmpDir, 'cp', [item, `${config.prodRepo}/${item}`]);
      }
    }

    // Stage, diff, commit
    await runInDir(config.prodRepo, 'git', ['add', '-A']);
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
    await runInDir(config.devRepo, 'git', ['worktree', 'remove', '--force', tmpDir]);
  }
}
