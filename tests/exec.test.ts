import { describe, it, expect } from 'vitest';
import { run, runInDir, spawnUntilMatch } from '../src/lib/exec.js';

describe('run', () => {
  it('captures stdout from a command', async () => {
    const result = await run('echo', ['hello']);
    expect(result.stdout.trim()).toBe('hello');
    expect(result.exitCode).toBe(0);
  });

  it('captures stderr from a command', async () => {
    const result = await run('sh', ['-c', 'echo err >&2']);
    expect(result.stderr.trim()).toBe('err');
  });

  it('returns non-zero exit code on failure without throwing', async () => {
    const result = await run('false', []);
    expect(result.exitCode).not.toBe(0);
    expect(result).toHaveProperty('stdout');
    expect(result).toHaveProperty('stderr');
  });

  it('returns exit code 1 and error message for non-existent command', async () => {
    const result = await run('nonexistent-command-xyz-999', []);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it('handles empty args array', async () => {
    const result = await run('echo', []);
    expect(result.exitCode).toBe(0);
  });

  it('handles args with spaces', async () => {
    const result = await run('echo', ['hello world']);
    expect(result.stdout.trim()).toBe('hello world');
  });
});

describe('runInDir', () => {
  it('runs command in specified directory', async () => {
    const result = await runInDir('/tmp', 'pwd', []);
    // /tmp may resolve to /private/tmp on macOS
    expect(result.stdout.trim()).toMatch(/\/tmp$/);
    expect(result.exitCode).toBe(0);
  });

  it('returns non-zero exit code for failures in directory', async () => {
    const result = await runInDir('/tmp', 'false', []);
    expect(result.exitCode).not.toBe(0);
  });

  it('returns error for non-existent directory', async () => {
    const result = await runInDir('/nonexistent-dir-xyz-999', 'pwd', []);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it('captures stdout in specified directory', async () => {
    const result = await runInDir('/tmp', 'echo', ['from-tmp']);
    expect(result.stdout.trim()).toBe('from-tmp');
  });
});

describe('spawnUntilMatch', () => {
  it('resolves when stdout matches pattern', async () => {
    const result = await spawnUntilMatch(
      '/tmp',
      'echo',
      ['hello-match-test'],
      /hello-match/,
    );
    expect(result.match).toBe('hello-match');
    expect(result.stdout).toContain('hello-match-test');
  });

  it('returns empty match when process exits before pattern found', async () => {
    const result = await spawnUntilMatch(
      '/tmp',
      'echo',
      ['no-match-here'],
      /will-never-match/,
    );
    expect(result.match).toBe('');
    expect(result.pid).toBeNull();
  });

  it('returns empty match on timeout', async () => {
    // sleep 10 will be killed after 200ms timeout
    const result = await spawnUntilMatch(
      '/tmp',
      'sleep',
      ['10'],
      /never/,
      200,
    );
    expect(result.match).toBe('');
    expect(result.stderr).toContain('Timed out');
  });

  it('returns error for non-existent command', async () => {
    const result = await spawnUntilMatch(
      '/tmp',
      'nonexistent-cmd-xyz-999',
      [],
      /anything/,
    );
    expect(result.match).toBe('');
    expect(result.stderr.length).toBeGreaterThan(0);
  });
});
