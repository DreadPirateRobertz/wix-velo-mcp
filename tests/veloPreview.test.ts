import { describe, it, expect, vi, beforeEach } from 'vitest';
import { veloPreview, veloPreviewStop } from '../src/tools/veloPreview.js';

const mockSpawnUntilMatch = vi.fn();

vi.mock('../src/lib/exec.js', () => ({
  spawnUntilMatch: (...args: unknown[]) => mockSpawnUntilMatch(...args),
}));

describe('veloPreview', () => {
  const config = { devRepo: '/fake/dev', prodRepo: '/fake/prod' };

  beforeEach(() => {
    mockSpawnUntilMatch.mockReset();
  });

  it('returns preview URL on success', async () => {
    mockSpawnUntilMatch.mockResolvedValueOnce({
      match: 'https://preview.wixsite.com/mysite',
      pid: 12345,
      stdout: 'Preview started at https://preview.wixsite.com/mysite\nWatching...',
      stderr: '',
    });

    const result = await veloPreview(config);
    expect(result).toContain('https://preview.wixsite.com/mysite');
    expect(result).toContain('Preview running at');
    expect(result).toContain('12345');
  });

  it('spawns wix dev from prodRepo', async () => {
    mockSpawnUntilMatch.mockResolvedValueOnce({
      match: 'https://preview.wixsite.com/test',
      pid: 999,
      stdout: '',
      stderr: '',
    });

    await veloPreview(config);

    expect(mockSpawnUntilMatch).toHaveBeenCalledWith(
      '/fake/prod',
      'npx',
      ['wix', 'dev'],
      expect.any(RegExp),
      expect.any(Number),
    );
  });

  it('returns error when no URL found (timeout)', async () => {
    mockSpawnUntilMatch.mockResolvedValueOnce({
      match: '',
      pid: null,
      stdout: 'Starting...',
      stderr: 'Timed out after 30s waiting for pattern match',
    });

    const result = await veloPreview(config);
    expect(result).toContain('ERROR');
    expect(result).toContain('Timed out');
  });

  it('returns error when process exits before URL', async () => {
    mockSpawnUntilMatch.mockResolvedValueOnce({
      match: '',
      pid: null,
      stdout: '',
      stderr: 'Error: Not logged in',
    });

    const result = await veloPreview(config);
    expect(result).toContain('ERROR');
    expect(result).toContain('Not logged in');
  });

  it('returns error when process exits with no output', async () => {
    mockSpawnUntilMatch.mockResolvedValueOnce({
      match: '',
      pid: null,
      stdout: '',
      stderr: '',
    });

    const result = await veloPreview(config);
    expect(result).toContain('ERROR');
    expect(result).toContain('No preview URL');
  });

  it('extracts URL from mixed output', async () => {
    mockSpawnUntilMatch.mockResolvedValueOnce({
      match: 'https://user.wixsite.com/carolina-futons',
      pid: 5678,
      stdout: 'Compiling...\nBundling...\nhttps://user.wixsite.com/carolina-futons',
      stderr: 'some warning',
    });

    const result = await veloPreview(config);
    expect(result).toContain('https://user.wixsite.com/carolina-futons');
    expect(result).not.toContain('ERROR');
  });

  it('includes background server note in success output', async () => {
    mockSpawnUntilMatch.mockResolvedValueOnce({
      match: 'https://preview.wixsite.com/site',
      pid: 4444,
      stdout: '',
      stderr: '',
    });

    const result = await veloPreview(config);
    expect(result).toContain('background');
    expect(result).toContain('velo_preview_stop');
  });
});

describe('veloPreviewStop', () => {
  it('stops a previously started server', async () => {
    // Start a preview first to set the PID
    mockSpawnUntilMatch.mockResolvedValueOnce({
      match: 'https://preview.wixsite.com/test',
      pid: 99999, // Non-existent PID — kill will throw, which is fine
      stdout: '',
      stderr: '',
    });
    await veloPreview({ devRepo: '/fake/dev', prodRepo: '/fake/prod' });

    const result = await veloPreviewStop();
    expect(result).toContain('99999');
    expect(result).toContain('stopped');
  });

  it('reports no server after stop has already been called', async () => {
    const result = await veloPreviewStop();
    expect(result).toContain('No dev server');
  });
});
