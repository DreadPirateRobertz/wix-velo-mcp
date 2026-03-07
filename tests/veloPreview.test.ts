import { describe, it, expect, vi, beforeEach } from 'vitest';
import { veloPreview } from '../src/tools/veloPreview.js';

const mockRun = vi.fn();
const mockRunInDir = vi.fn();

vi.mock('../src/lib/exec.js', () => ({
  run: (...args: unknown[]) => mockRun(...args),
  runInDir: (...args: unknown[]) => mockRunInDir(...args),
}));

describe('veloPreview', () => {
  const config = { devRepo: '/fake/dev', prodRepo: '/fake/prod' };

  beforeEach(() => {
    mockRun.mockReset();
    mockRunInDir.mockReset();
  });

  it('returns preview URL on success', async () => {
    mockRunInDir.mockResolvedValueOnce({
      stdout: 'Preview started at https://preview.wixsite.com/mysite\nWatching for changes...',
      stderr: '',
      exitCode: 0,
    });

    const result = await veloPreview(config);
    expect(result).toContain('https://preview.wixsite.com/mysite');
    expect(result).toContain('Preview');
  });

  it('runs wix dev from prodRepo directory', async () => {
    mockRunInDir.mockResolvedValueOnce({
      stdout: 'Preview at https://preview.wixsite.com/test',
      stderr: '',
      exitCode: 0,
    });

    await veloPreview(config);

    expect(mockRunInDir).toHaveBeenCalledWith(
      '/fake/prod',
      'npx',
      expect.arrayContaining(['wix', 'dev']),
    );
  });

  it('returns error when wix dev fails', async () => {
    mockRunInDir.mockResolvedValueOnce({
      stdout: '',
      stderr: 'Error: Not logged in',
      exitCode: 1,
    });

    const result = await veloPreview(config);
    expect(result).toContain('ERROR');
    expect(result).toContain('Not logged in');
  });

  it('returns error when no URL found in output', async () => {
    mockRunInDir.mockResolvedValueOnce({
      stdout: 'Starting preview...\nDone.',
      stderr: '',
      exitCode: 0,
    });

    const result = await veloPreview(config);
    expect(result).toContain('ERROR');
    expect(result).toContain('No preview URL');
  });

  it('extracts URL from mixed output', async () => {
    mockRunInDir.mockResolvedValueOnce({
      stdout: 'Compiling...\nBundling...\nPreview started at https://user.wixsite.com/carolina-futons\nPress Ctrl+C to stop',
      stderr: 'some warning',
      exitCode: 0,
    });

    const result = await veloPreview(config);
    expect(result).toContain('https://user.wixsite.com/carolina-futons');
  });

  it('handles stderr warnings alongside success', async () => {
    mockRunInDir.mockResolvedValueOnce({
      stdout: 'Preview at https://preview.wixsite.com/site',
      stderr: 'Warning: deprecated API',
      exitCode: 0,
    });

    const result = await veloPreview(config);
    expect(result).toContain('https://preview.wixsite.com/site');
    // Should still succeed despite stderr warnings
    expect(result).not.toContain('ERROR');
  });

  it('returns error on non-zero exit with no stderr', async () => {
    mockRunInDir.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });

    const result = await veloPreview(config);
    expect(result).toContain('ERROR');
    expect(result).toContain('preview failed');
  });
});
