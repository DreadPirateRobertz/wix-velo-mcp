import { run, runInDir } from '../lib/exec.js';
import type { VeloConfig } from '../lib/config.js';

/**
 * Check Wix CLI auth status, prod repo git state, and last deployed tag.
 */
export async function veloStatus(config: VeloConfig): Promise<string> {
  const [whoami, gitStatus, gitTag, gitLog] = await Promise.all([
    run('npx', ['wix', 'whoami']),
    runInDir(config.prodRepo, 'git', ['status', '--porcelain']),
    runInDir(config.prodRepo, 'git', ['describe', '--tags', '--abbrev=0']),
    runInDir(config.prodRepo, 'git', ['log', '-1', '--oneline']),
  ]);

  const authLine = whoami.exitCode === 0
    ? `Auth: ${whoami.stdout.trim()}`
    : 'Auth: NOT LOGGED IN (run wix login)';

  const repoState = gitStatus.stdout.trim() === ''
    ? 'Repo: clean'
    : `Repo: dirty\n${gitStatus.stdout.trim()}`;

  const currentTag = gitTag.exitCode === 0
    ? `Deployed tag: ${gitTag.stdout.trim()}`
    : 'Deployed tag: none';

  const lastCommit = `Last commit: ${gitLog.stdout.trim()}`;

  return [authLine, repoState, currentTag, lastCommit].join('\n');
}
