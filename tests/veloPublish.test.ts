import { describe, it, expect, vi, beforeEach } from 'vitest';
import { veloPublish } from '../src/tools/veloPublish.js';

const mockRunInDir = vi.fn();

vi.mock('../src/lib/exec.js', () => ({
  runInDir: (...args: unknown[]) => mockRunInDir(...args),
}));

describe('veloPublish', () => {
  const config = { devRepo: '/fake/dev', prodRepo: '/fake/prod' };

  beforeEach(() => {
    mockRunInDir.mockReset();
  });

  it('publishes successfully when worktree is clean and tests pass', async () => {
    // git status --porcelain (clean)
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    // npm test
    mockRunInDir.mockResolvedValueOnce({ stdout: 'Tests passed', stderr: '', exitCode: 0 });
    // wix publish
    mockRunInDir.mockResolvedValueOnce({ stdout: 'Published successfully', stderr: '', exitCode: 0 });

    const result = await veloPublish(config);
    expect(result).toContain('Published successfully');
    expect(result).not.toContain('ERROR');
  });

  it('rejects when worktree is dirty', async () => {
    // git status --porcelain (dirty)
    mockRunInDir.mockResolvedValueOnce({ stdout: 'M src/pages/Home.js', stderr: '', exitCode: 0 });

    const result = await veloPublish(config);
    expect(result).toContain('ERROR');
    expect(result).toContain('dirty');
    // Should NOT run tests or publish
    expect(mockRunInDir).toHaveBeenCalledTimes(1);
  });

  it('rejects when tests fail', async () => {
    // git status --porcelain (clean)
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    // npm test (fails)
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '3 tests failed', exitCode: 1 });

    const result = await veloPublish(config);
    expect(result).toContain('ERROR');
    expect(result).toContain('Tests failed');
    // Should NOT publish
    expect(mockRunInDir).toHaveBeenCalledTimes(2);
  });

  it('returns error when wix publish fails', async () => {
    // git status (clean)
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    // npm test (passes)
    mockRunInDir.mockResolvedValueOnce({ stdout: 'ok', stderr: '', exitCode: 0 });
    // wix publish (fails)
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: 'Auth expired', exitCode: 1 });

    const result = await veloPublish(config);
    expect(result).toContain('ERROR');
    expect(result).toContain('Auth expired');
  });

  it('runs all commands against prodRepo', async () => {
    // git status (clean)
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    // npm test
    mockRunInDir.mockResolvedValueOnce({ stdout: 'ok', stderr: '', exitCode: 0 });
    // wix publish
    mockRunInDir.mockResolvedValueOnce({ stdout: 'Published', stderr: '', exitCode: 0 });

    await veloPublish(config);

    for (const call of mockRunInDir.mock.calls) {
      expect(call[0]).toBe('/fake/prod');
    }
  });

  it('uses npx wix publish with --source local and -y flags', async () => {
    // git status (clean)
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    // npm test
    mockRunInDir.mockResolvedValueOnce({ stdout: 'ok', stderr: '', exitCode: 0 });
    // wix publish
    mockRunInDir.mockResolvedValueOnce({ stdout: 'Published', stderr: '', exitCode: 0 });

    await veloPublish(config);

    const publishCall = mockRunInDir.mock.calls[2];
    expect(publishCall[1]).toBe('npx');
    expect(publishCall[2]).toContain('wix');
    expect(publishCall[2]).toContain('publish');
    expect(publishCall[2]).toContain('-y');
  });

  it('includes test output in error when tests fail', async () => {
    // git status (clean)
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    // npm test (fails with output)
    mockRunInDir.mockResolvedValueOnce({
      stdout: 'FAIL src/test.ts\n  ✗ should validate input',
      stderr: '1 test failed',
      exitCode: 1,
    });

    const result = await veloPublish(config);
    expect(result).toContain('Tests failed');
  });

  it('shows dirty files in error message', async () => {
    // git status (dirty with multiple files)
    mockRunInDir.mockResolvedValueOnce({
      stdout: 'M src/pages/Home.js\n?? src/pages/New.js',
      stderr: '',
      exitCode: 0,
    });

    const result = await veloPublish(config);
    expect(result).toContain('M src/pages/Home.js');
  });
});
