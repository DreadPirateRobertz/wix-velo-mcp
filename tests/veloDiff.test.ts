import { describe, it, expect, vi, beforeEach } from 'vitest';
import { veloDiff, isValidTag } from '../src/tools/veloDiff.js';

// ── isValidTag ──────────────────────────────────────────────────────

describe('isValidTag', () => {
  it('accepts semver tags', () => {
    expect(isValidTag('v0.0.0')).toBe(true);
    expect(isValidTag('v1.2.3')).toBe(true);
    expect(isValidTag('v10.20.30')).toBe(true);
  });

  it('rejects non-tag refs', () => {
    expect(isValidTag('main')).toBe(false);
    expect(isValidTag('abc1234')).toBe(false);
    expect(isValidTag('feature/foo')).toBe(false);
    expect(isValidTag('')).toBe(false);
  });

  it('rejects malicious inputs', () => {
    expect(isValidTag('v1.0.0; rm -rf /')).toBe(false);
    expect(isValidTag('v1.0.0$(whoami)')).toBe(false);
  });
});

// ── veloDiff ────────────────────────────────────────────────────────

const mockRunInDir = vi.fn();

vi.mock('../src/lib/exec.js', () => ({
  runInDir: (...args: unknown[]) => mockRunInDir(...args),
}));

describe('veloDiff', () => {
  beforeEach(() => {
    mockRunInDir.mockReset();
  });

  it('rejects invalid tag', async () => {
    const result = await veloDiff(
      { devRepo: '/fake/dev', prodRepo: '/fake/prod' },
      { tag: 'main' },
    );
    expect(result).toContain('ERROR');
    expect(result).toContain('not a valid release tag');
  });

  it('rejects empty tag with no fallback', async () => {
    // No tags in repo
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: 'fatal', exitCode: 128 });

    const result = await veloDiff(
      { devRepo: '/fake/dev', prodRepo: '/fake/prod' },
      {},
    );
    expect(result).toContain('ERROR');
    expect(result).toContain('No tags');
  });

  it('uses latest tag when no tag specified', async () => {
    // git describe returns latest tag
    mockRunInDir.mockResolvedValueOnce({ stdout: 'v0.1.0', stderr: '', exitCode: 0 });
    // git tag -l verifies tag exists
    mockRunInDir.mockResolvedValueOnce({ stdout: 'v0.1.0', stderr: '', exitCode: 0 });
    // git worktree add
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    // rsync dry-run
    mockRunInDir.mockResolvedValueOnce({ stdout: '>f src/pages/Home.js', stderr: '', exitCode: 0 });
    // git worktree remove
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    const result = await veloDiff(
      { devRepo: '/fake/dev', prodRepo: '/fake/prod' },
      {},
    );
    expect(result).toContain('v0.1.0');
    expect(result).toContain('Home.js');
  });

  it('returns "no differences" when rsync shows nothing', async () => {
    // git tag -l
    mockRunInDir.mockResolvedValueOnce({ stdout: 'v0.0.0', stderr: '', exitCode: 0 });
    // git worktree add
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    // rsync dry-run (no output = no differences)
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    // git worktree remove
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    const result = await veloDiff(
      { devRepo: '/fake/dev', prodRepo: '/fake/prod' },
      { tag: 'v0.0.0' },
    );
    expect(result).toContain('No differences');
    expect(result).toContain('v0.0.0');
  });

  it('shows diff output for valid tag with changes', async () => {
    // git tag -l
    mockRunInDir.mockResolvedValueOnce({ stdout: 'v0.1.0', stderr: '', exitCode: 0 });
    // git worktree add
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    // rsync dry-run shows changes
    mockRunInDir.mockResolvedValueOnce({
      stdout: '>f+++++++++ src/pages/NewPage.js\n.d..t...... src/public/',
      stderr: '',
      exitCode: 0,
    });
    // git worktree remove
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    const result = await veloDiff(
      { devRepo: '/fake/dev', prodRepo: '/fake/prod' },
      { tag: 'v0.1.0' },
    );
    expect(result).toContain('Changes if synced to v0.1.0');
    expect(result).toContain('NewPage.js');
  });

  it('returns error when tag not found in dev repo', async () => {
    // git tag -l returns empty (tag doesn't exist)
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    const result = await veloDiff(
      { devRepo: '/fake/dev', prodRepo: '/fake/prod' },
      { tag: 'v9.9.9' },
    );
    expect(result).toContain('ERROR');
    expect(result).toContain('not found');
  });

  it('returns error when worktree checkout fails', async () => {
    // git tag -l
    mockRunInDir.mockResolvedValueOnce({ stdout: 'v0.1.0', stderr: '', exitCode: 0 });
    // git worktree add fails
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: 'worktree error', exitCode: 128 });

    const result = await veloDiff(
      { devRepo: '/fake/dev', prodRepo: '/fake/prod' },
      { tag: 'v0.1.0' },
    );
    expect(result).toContain('ERROR');
    expect(result).toContain('Failed to checkout');
  });

  it('always cleans up worktree even on rsync failure', async () => {
    // git tag -l
    mockRunInDir.mockResolvedValueOnce({ stdout: 'v0.1.0', stderr: '', exitCode: 0 });
    // git worktree add
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    // rsync fails
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: 'rsync error', exitCode: 1 });
    // git worktree remove (cleanup)
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    await veloDiff(
      { devRepo: '/fake/dev', prodRepo: '/fake/prod' },
      { tag: 'v0.1.0' },
    );

    // Verify worktree remove was called (last mock call)
    const lastCall = mockRunInDir.mock.calls[mockRunInDir.mock.calls.length - 1];
    expect(lastCall[1]).toBe('git');
    expect(lastCall[2]).toContain('worktree');
    expect(lastCall[2]).toContain('remove');
  });
});
