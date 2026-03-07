import { spawnUntilMatch } from '../lib/exec.js';
import type { VeloConfig } from '../lib/config.js';

const URL_PATTERN = /https?:\/\/\S+/;
const TIMEOUT_MS = 30_000;

/** PID of the running dev server, if any. */
let devServerPid: number | null = null;

/**
 * Start `wix dev` in the prod repo and capture the preview URL from stdout.
 * The dev server continues running in the background.
 * Use veloPreviewStop to shut it down.
 */
export async function veloPreview(config: VeloConfig): Promise<string> {
  // Kill any existing dev server first
  if (devServerPid !== null) {
    try { process.kill(devServerPid, 'SIGTERM'); } catch { /* already dead */ }
    devServerPid = null;
  }

  const result = await spawnUntilMatch(
    config.prodRepo,
    'npx',
    ['wix', 'dev'],
    URL_PATTERN,
    TIMEOUT_MS,
  );

  if (!result.match) {
    const detail = result.stderr.trim() || 'No preview URL found in output';
    return `ERROR: ${detail}`;
  }

  devServerPid = result.pid;

  const pidInfo = devServerPid ? ` (PID: ${devServerPid})` : '';
  return `Preview running at: ${result.match}${pidInfo}\n\nDev server is running in the background. Use velo_preview_stop to shut down.`;
}

/**
 * Stop the running dev server, if any.
 */
export async function veloPreviewStop(): Promise<string> {
  if (devServerPid === null) {
    return 'No dev server is currently running.';
  }

  const pid = devServerPid;
  devServerPid = null;

  try {
    process.kill(pid, 'SIGTERM');
    return `Dev server (PID ${pid}) stopped.`;
  } catch {
    return `Dev server (PID ${pid}) was already stopped.`;
  }
}
