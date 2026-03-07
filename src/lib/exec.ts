import { execa } from 'execa';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
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
