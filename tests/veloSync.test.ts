import { describe, it, expect, vi, beforeEach } from 'vitest';
import { veloSync, isValidTag } from '../src/tools/veloSync.js';

// ── isValidTag (pure function, no mocks needed) ──────────────────────

describe('isValidTag', () => {
  it('accepts v0.0.0', () => expect(isValidTag('v0.0.0')).toBe(true));
  it('accepts v1.2.3', () => expect(isValidTag('v1.2.3')).toBe(true));
  it('accepts v10.20.30', () => expect(isValidTag('v10.20.30')).toBe(true));

  it('rejects main', () => expect(isValidTag('main')).toBe(false));
  it('rejects commit hash', () => expect(isValidTag('abc1234')).toBe(false));
  it('rejects feature branch', () => expect(isValidTag('feature/foo')).toBe(false));
  it('rejects empty string', () => expect(isValidTag('')).toBe(false));
  it('rejects without v prefix', () => expect(isValidTag('1.2.3')).toBe(false));
  it('rejects v prefix only', () => expect(isValidTag('v')).toBe(false));
  it('rejects partial semver', () => expect(isValidTag('v1.2')).toBe(false));
  it('rejects trailing text', () => expect(isValidTag('v1.2.3-beta')).toBe(false));
});

// ── veloSync (mocked exec) ──────────────────────────────────────────

const mockRunInDir = vi.fn();

vi.mock('../src/lib/exec.js', () => ({
  run: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
  runInDir: (...args: unknown[]) => mockRunInDir(...args),
}));

describe('veloSync', () => {
  const config = { devRepo: '/fake/dev', prodRepo: '/fake/prod' };

  beforeEach(() => {
    mockRunInDir.mockReset();
  });

  // Helper to set up a full successful sync flow
  function setupSuccessFlow(tag: string) {
    let callIndex = 0;
    mockRunInDir.mockImplementation((_cwd: string, cmd: string, args: string[]) => {
      // 1. tag -l check
      if (cmd === 'git' && args[0] === 'tag' && args[1] === '-l') {
        return { stdout: tag, stderr: '', exitCode: 0 };
      }
      // 2. worktree add
      if (cmd === 'git' && args[0] === 'worktree' && args[1] === 'add') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      // 3. rm -rf
      if (cmd === 'rm') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      // 4. cp commands
      if (cmd === 'cp') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      // 5. git add
      if (cmd === 'git' && args[0] === 'add') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      // 6. git diff --cached --stat
      if (cmd === 'git' && args[0] === 'diff') {
        return { stdout: ' 3 files changed, 50 insertions(+)', stderr: '', exitCode: 0 };
      }
      // 7. git commit
      if (cmd === 'git' && args[0] === 'commit') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      // 8. git push
      if (cmd === 'git' && args[0] === 'push') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      // 9. worktree remove (cleanup)
      if (cmd === 'git' && args[0] === 'worktree' && args[1] === 'remove') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });
  }

  it('rejects invalid tag (branch name)', async () => {
    const result = await veloSync(config, { tag: 'main' });
    expect(result).toContain('ERROR');
    expect(result).toContain('tag');
  });

  it('rejects empty tag', async () => {
    const result = await veloSync(config, { tag: '' });
    expect(result).toContain('ERROR');
  });

  it('rejects tag not found in dev repo', async () => {
    mockRunInDir.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    const result = await veloSync(config, { tag: 'v9.9.9' });
    expect(result).toContain('ERROR');
    expect(result).toContain('not found');
  });

  it('returns error when worktree creation fails', async () => {
    mockRunInDir.mockImplementation((_cwd: string, cmd: string, args: string[]) => {
      if (cmd === 'git' && args[0] === 'tag') {
        return { stdout: 'v0.0.0', stderr: '', exitCode: 0 };
      }
      if (cmd === 'git' && args[0] === 'worktree' && args[1] === 'add') {
        return { stdout: '', stderr: 'worktree already exists', exitCode: 128 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    const result = await veloSync(config, { tag: 'v0.0.0' });
    expect(result).toContain('ERROR');
    expect(result).toContain('checkout');
  });

  it('reports no changes when diff is empty', async () => {
    mockRunInDir.mockImplementation((_cwd: string, cmd: string, args: string[]) => {
      if (cmd === 'git' && args[0] === 'tag' && args[1] === '-l') {
        return { stdout: 'v0.0.0', stderr: '', exitCode: 0 };
      }
      if (cmd === 'git' && args[0] === 'worktree') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      if (cmd === 'git' && args[0] === 'diff') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    const result = await veloSync(config, { tag: 'v0.0.0' });
    expect(result).toContain('No changes');
    expect(result).toContain('v0.0.0');
  });

  it('returns success with diff stats on successful sync', async () => {
    setupSuccessFlow('v0.0.0');
    const result = await veloSync(config, { tag: 'v0.0.0' });
    expect(result).toContain('Synced');
    expect(result).toContain('v0.0.0');
    expect(result).toContain('Pushed');
  });

  it('warns when push fails but sync succeeded', async () => {
    mockRunInDir.mockImplementation((_cwd: string, cmd: string, args: string[]) => {
      if (cmd === 'git' && args[0] === 'tag' && args[1] === '-l') {
        return { stdout: 'v0.0.0', stderr: '', exitCode: 0 };
      }
      if (cmd === 'git' && args[0] === 'worktree') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      if (cmd === 'git' && args[0] === 'diff') {
        return { stdout: '3 files changed', stderr: '', exitCode: 0 };
      }
      if (cmd === 'git' && args[0] === 'commit') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      if (cmd === 'git' && args[0] === 'push') {
        return { stdout: '', stderr: 'remote rejected', exitCode: 1 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    const result = await veloSync(config, { tag: 'v0.0.0' });
    expect(result).toContain('WARNING');
    expect(result).toContain('Push failed');
  });

  it('returns error when commit fails', async () => {
    mockRunInDir.mockImplementation((_cwd: string, cmd: string, args: string[]) => {
      if (cmd === 'git' && args[0] === 'tag' && args[1] === '-l') {
        return { stdout: 'v0.0.0', stderr: '', exitCode: 0 };
      }
      if (cmd === 'git' && args[0] === 'worktree') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      if (cmd === 'git' && args[0] === 'diff') {
        return { stdout: '3 files changed', stderr: '', exitCode: 0 };
      }
      if (cmd === 'git' && args[0] === 'commit') {
        return { stdout: '', stderr: 'nothing to commit', exitCode: 1 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    const result = await veloSync(config, { tag: 'v0.0.0' });
    expect(result).toContain('ERROR');
    expect(result).toContain('commit');
  });

  it('cleans up worktree even on error', async () => {
    mockRunInDir.mockImplementation((_cwd: string, cmd: string, args: string[]) => {
      if (cmd === 'git' && args[0] === 'tag' && args[1] === '-l') {
        return { stdout: 'v0.0.0', stderr: '', exitCode: 0 };
      }
      if (cmd === 'git' && args[0] === 'worktree' && args[1] === 'add') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      if (cmd === 'rm') {
        throw new Error('disk full');
      }
      if (cmd === 'git' && args[0] === 'worktree' && args[1] === 'remove') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    // Should not throw — cleanup should still run
    try {
      await veloSync(config, { tag: 'v0.0.0' });
    } catch {
      // If it throws, that's also acceptable — but cleanup should have been attempted
    }

    // Verify worktree remove was called
    const removeCalls = mockRunInDir.mock.calls.filter(
      (c: unknown[]) => c[1] === 'git' && (c[2] as string[])[0] === 'worktree' && (c[2] as string[])[1] === 'remove'
    );
    expect(removeCalls.length).toBeGreaterThan(0);
  });

  it('uses devRepo for tag check and worktree', async () => {
    setupSuccessFlow('v0.0.0');
    await veloSync(config, { tag: 'v0.0.0' });

    // tag -l should be against devRepo
    const tagCall = mockRunInDir.mock.calls.find(
      (c: unknown[]) => c[1] === 'git' && (c[2] as string[])[0] === 'tag'
    );
    expect(tagCall?.[0]).toBe('/fake/dev');
  });

  it('uses prodRepo for git add/commit/push', async () => {
    setupSuccessFlow('v0.0.0');
    await veloSync(config, { tag: 'v0.0.0' });

    const addCall = mockRunInDir.mock.calls.find(
      (c: unknown[]) => c[1] === 'git' && (c[2] as string[])[0] === 'add'
    );
    expect(addCall?.[0]).toBe('/fake/prod');

    const commitCall = mockRunInDir.mock.calls.find(
      (c: unknown[]) => c[1] === 'git' && (c[2] as string[])[0] === 'commit'
    );
    expect(commitCall?.[0]).toBe('/fake/prod');
  });
});
