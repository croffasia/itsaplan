import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';

// npm installs a CLI on Windows as a .cmd shim. Node starts a .cmd only through cmd.exe,
// which cannot pass a newline inside an argument, and a preset passes the system prompt as
// one. The runner therefore starts what the shim points at: the CLI's own .exe, or node
// with the CLI's script.
export function resolveCommand(
  bin: string,
  args: string[],
  env: Record<string, string | undefined>,
  platform: NodeJS.Platform = process.platform,
): [string, string[]] {
  if (platform !== 'win32') return [bin, args];
  const found = findOnPath(bin, env);
  if (!found) return [bin, args];
  const ext = extname(found).toLowerCase();
  if (ext !== '.cmd' && ext !== '.bat') return [found, args];
  const target = shimTarget(found);
  if (!target) {
    throw new Error(
      `${found} is a ${ext} script that only cmd.exe can start. Install the CLI's own executable, or run the runner in WSL.`,
    );
  }
  if (!/\.[cm]?js$/i.test(target)) return [target, args];
  const shimNode = join(dirname(found), 'node.exe');
  return [existsSync(shimNode) ? shimNode : process.execPath, [target, ...args]];
}

// Windows environment names are case-insensitive, and the PATH variable is often `Path`.
function envValue(env: Record<string, string | undefined>, name: string): string | undefined {
  const key = Object.keys(env).find((candidate) => candidate.toUpperCase() === name);
  return key === undefined ? undefined : env[key];
}

function findOnPath(bin: string, env: Record<string, string | undefined>): string | null {
  const exts = (envValue(env, 'PATHEXT') ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean);
  const names = extname(bin) ? [bin] : exts.map((ext) => bin + ext.toLowerCase());
  for (const dir of (envValue(env, 'PATH') ?? '').split(';').filter(Boolean)) {
    for (const name of names) {
      const path = join(dir, name);
      if (existsSync(path)) return path;
    }
  }
  return null;
}

// A shim written by npm's cmd-shim names its target last, relative to the shim's folder:
// `"%dp0%\node_modules\pkg\cli.js" %*`. A shim for a script also names `%dp0%\node.exe`
// before it.
function shimTarget(shim: string): string | null {
  const targets = [...readFileSync(shim, 'utf8').matchAll(/"%~?dp0%?\\([^"]+)"/g)].map(
    (match) => match[1] ?? '',
  );
  const target = targets.at(-1);
  return target ? join(dirname(shim), target.replace(/\\/g, '/')) : null;
}
