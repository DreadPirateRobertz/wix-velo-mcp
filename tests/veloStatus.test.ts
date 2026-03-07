import { describe, it, expect, vi, beforeEach } from 'vitest';
import { veloStatus } from '../src/tools/veloStatus.js';

const mockRun = vi.fn();
const mockRunInDir = vi.fn();

vi.mock('../src/lib/exec.js', () => ({
  run: (...args: unknown[]) => mockRun(...args),
  runInDir: (...args: unknown[]) => mockRunInDir(...args),
}));

describe('veloStatus', () => {
  const config = { devRepo: '/fake/dev', prodRepo: '/fake/prod' };

  beforeEach(() => {
    mockRun.mockReset();
    mockRunInDir.mockReset();
  });

  function setupHappy() {
    // wix whoami
    mockRun.mockResolvedValue({
      stdout: 'Logged in as test@example.com',
      stderr: '',
      exitCode: 0,
    });
    // git status, describe, log
    mockRunInDir.mockImplementation((_cwd: string, cmd: string, args: string[]) => {
      if (cmd === 'git' && args[0] === 'status') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      if (cmd === 'git' && args[0] === 'describe') {
        return { stdout: 'v0.0.0', stderr: '', exitCode: 0 };
      }
      if (cmd === 'git' && args[0] === 'log') {
        return { stdout: 'abc1234 release: v0.0.0', stderr: '', exitCode: 0 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });
  }

  it('returns auth email when logged in', async () => {
    setupHappy();
    const result = await veloStatus(config);
    expect(result).toContain('test@example.com');
  });

  it('shows NOT LOGGED IN when wix whoami fails', async () => {
    mockRun.mockResolvedValue({ stdout: '', stderr: 'not logged in', exitCode: 1 });
    mockRunInDir.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    const result = await veloStatus(config);
    expect(result).toContain('NOT LOGGED IN');
  });

  it('shows repo clean when git status is empty', async () => {
    setupHappy();
    const result = await veloStatus(config);
    expect(result).toContain('clean');
  });

  it('shows repo dirty when git status has changes', async () => {
    mockRun.mockResolvedValue({ stdout: 'Logged in', stderr: '', exitCode: 0 });
    mockRunInDir.mockImplementation((_cwd: string, cmd: string, args: string[]) => {
      if (cmd === 'git' && args[0] === 'status') {
        return { stdout: 'M src/pages/Home.js', stderr: '', exitCode: 0 };
      }
      if (cmd === 'git' && args[0] === 'describe') {
        return { stdout: 'v0.0.0', stderr: '', exitCode: 0 };
      }
      if (cmd === 'git' && args[0] === 'log') {
        return { stdout: 'abc1234 some commit', stderr: '', exitCode: 0 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    const result = await veloStatus(config);
    expect(result).toContain('dirty');
    expect(result).toContain('M src/pages/Home.js');
  });

  it('shows deployed tag when git describe succeeds', async () => {
    setupHappy();
    const result = await veloStatus(config);
    expect(result).toContain('v0.0.0');
  });

  it('shows no tag when git describe fails', async () => {
    mockRun.mockResolvedValue({ stdout: 'Logged in', stderr: '', exitCode: 0 });
    mockRunInDir.mockImplementation((_cwd: string, cmd: string, args: string[]) => {
      if (cmd === 'git' && args[0] === 'describe') {
        return { stdout: '', stderr: 'fatal: no tag', exitCode: 128 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    const result = await veloStatus(config);
    expect(result).toContain('none');
  });

  it('shows last commit info', async () => {
    setupHappy();
    const result = await veloStatus(config);
    expect(result).toContain('abc1234');
    expect(result).toContain('release: v0.0.0');
  });

  it('runs git commands against prodRepo path', async () => {
    setupHappy();
    await veloStatus(config);

    const runInDirCalls = mockRunInDir.mock.calls;
    for (const call of runInDirCalls) {
      expect(call[0]).toBe('/fake/prod');
    }
  });

  it('uses npx wix whoami for auth check', async () => {
    setupHappy();
    await veloStatus(config);

    expect(mockRun).toHaveBeenCalledWith('npx', ['wix', 'whoami']);
  });
});
