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
 */
export async function runInDir(
  cwd: string,
  cmd: string,
  args: string[],
): Promise<ExecResult> {
  try {
    const result = await execa(cmd, args, { cwd, reject: false });
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
