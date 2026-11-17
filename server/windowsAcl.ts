import { execFileSync } from 'node:child_process';

/**
 * Best-effort: restricts a freshly-created machine-wide data directory to SYSTEM, Administrators
 * and the account this process runs as. Never touches a directory that already existed (an existing
 * install's permissions are left exactly as they are) and never blocks startup if `icacls` fails —
 * a permissions warning is better than refusing to open the clinic for a missing ACL tool.
 */
export function restrictToServiceAndAdmins(dir: string, log: (m: string) => void = console.warn): void {
  if (process.platform !== 'win32') return;
  const who = process.env.USERDOMAIN && process.env.USERNAME ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}` : null;
  const grants = ['SYSTEM:(OI)(CI)F', 'Administrators:(OI)(CI)F', ...(who ? [`${who}:(OI)(CI)F`] : [])];
  try {
    execFileSync('icacls', [dir, '/inheritance:r', ...grants.flatMap((g) => ['/grant:r', g])], { stdio: 'ignore' });
  } catch (e) {
    log(`Could not restrict permissions on ${dir}: ${(e as Error).message}. The folder remains readable by other accounts on this machine.`);
  }
}
