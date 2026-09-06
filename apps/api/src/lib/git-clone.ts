export interface GitCloner {
  clone(githubUrl: string, destDir: string): Promise<void>;
}

/**
 * Real implementation performs `git clone --depth 1`. Kept behind this interface so tests
 * can inject a mock clone boundary and stay fully network-independent in CI.
 */
export class RealGitCloner implements GitCloner {
  async clone(githubUrl: string, destDir: string): Promise<void> {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);
    await execFileAsync('git', ['clone', '--depth', '1', githubUrl, destDir]);
  }
}
