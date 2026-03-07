import { execa } from 'execa';
import { spawn, type ChildProcess } from 'node:child_process';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SpawnMatchResult {
  match: string;
  pid: number | null;
  stdout: string;
  stderr: string;
}

const DEFAULT_SPAWN_TIMEOUT_MS = 30_000;

/**
 * Spawn a long-running process and resolve when stdout matches a pattern.
 * The process keeps running after the match is found.
 * Returns the matched string and the process PID for later cleanup.
 */
export async function spawnUntilMatch(
  cwd: string,
  cmd: string,
  args: string[],
  pattern: RegExp,
  timeoutMs: number = DEFAULT_SPAWN_TIMEOUT_MS,
): Promise<SpawnMatchResult> {
  return new Promise((resolve) => {
    const child: ChildProcess = spawn(cmd, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;

    const finish = (result: SpawnMatchResult) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish({
        match: '',
        pid: null,
        stdout,
        stderr: stderr || `Timed out after ${timeoutMs / 1000}s waiting for pattern match`,
      });
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      const m = stdout.match(pattern);
      if (m) {
        finish({ match: m[0], pid: child.pid ?? null, stdout, stderr });
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      finish({ match: '', pid: null, stdout, stderr: err.message });
    });

    child.on('close', (code) => {
      finish({
        match: '',
        pid: null,
        stdout,
        stderr: stderr || `Process exited with code ${code} before pattern matched`,
      });
    });
  });
}

/**
 * Run a command, capturing output. Never throws — returns exit code.
 */
export async function run(cmd: string, args: string[]): Promise<ExecResult> {
  try {
    const result = await execa(cmd, args, { reject: false });
    const failed = result.failed || result.exitCode == null;
    const stderr = result.stderr || (failed ? (result.message ?? '') : '');
    return {
      stdout: result.stdout ?? '',
      stderr,
      exitCode: failed ? (result.exitCode ?? 1) : (result.exitCode ?? 0),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { stdout: '', stderr: msg, exitCode: 1 };
  }
}

/**
 * Run a command in a specific directory.
 * @param timeoutMs - Optional timeout in milliseconds. Process is killed if exceeded.
 */
export async function runInDir(
  cwd: string,
  cmd: string,
  args: string[],
  timeoutMs?: number,
): Promise<ExecResult> {
  try {
    const opts: Record<string, unknown> = { cwd, reject: false };
    if (timeoutMs) opts.timeout = timeoutMs;
    const result = await execa(cmd, args, opts);
    const failed = result.failed || result.exitCode == null;
    const stderr = result.stderr || (failed ? (result.message ?? '') : '');
    return {
      stdout: result.stdout ?? '',
      stderr,
      exitCode: failed ? (result.exitCode ?? 1) : (result.exitCode ?? 0),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { stdout: '', stderr: msg, exitCode: 1 };
  }
}
