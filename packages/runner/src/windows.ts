import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';

// npm installs a CLI on Windows as a .cmd shim. Node starts a .cmd only through cmd.exe,
// which cannot pass a newline inside an argument, and a preset passes the system prompt as
// one. The runner therefore starts what the shim starts: the CLI's own executable, or the
// interpreter the shim names, with the CLI's script.
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
  const shim = parseShim(found);
  if (!shim) {
    throw new Error(
      `${found} is a ${ext} script that only cmd.exe can start. Install the CLI's own executable, or run the runner in WSL.`,
    );
  }
  if (!shim.prog) return [shim.target, args];
  const progArgs = [...shim.prog.args, shim.target, ...args];
  if (shim.prog.local && existsSync(shim.prog.local)) return [shim.prog.local, progArgs];
  return resolveCommand(shim.prog.name, progArgs, env, platform);
}

// Node gives the child the first of the case variants of a name in sorted order, so the
// lookup reads that one too.
function envValue(env: Record<string, string | undefined>, name: string): string | undefined {
  const key = Object.keys(env)
    .filter((candidate) => candidate.toUpperCase() === name)
    .sort()[0];
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

interface Shim {
  target: string;
  // Absent when the shim starts the target itself, as it does an executable.
  prog?: { local: string | null; name: string; args: string[] };
}

const DP0 = /^%~?dp0%?\\/;

function fromShim(shim: string, path: string): string {
  return join(dirname(shim), path.replace(DP0, '').replace(/\\/g, '/'));
}

// npm's cmd-shim names the target last, relative to the shim's folder:
// `"%dp0%\node_modules\pkg\cli.js" %*`. For a script it sets `_prog` to the interpreter
// of the script's shebang, the copy next to the shim when there is one and the bare name
// otherwise, and writes the shebang's arguments between `"%_prog%"` and the target.
function parseShim(shim: string): Shim | null {
  const text = readFileSync(shim, 'utf8');
  const target = [...text.matchAll(/"(%~?dp0%?\\[^"]+)"/g)].at(-1)?.[1];
  if (!target) return null;
  const progs = [...text.matchAll(/SET "_prog=([^"]+)"/g)].map((match) => match[1] ?? '');
  if (progs.length === 0) return { target: fromShim(shim, target) };
  const local = progs.find((prog) => DP0.test(prog));
  const between = text.match(/"%_prog%"\s+(.*?)\s*"%~?dp0%?\\/)?.[1] ?? '';
  return {
    target: fromShim(shim, target),
    prog: {
      local: local ? fromShim(shim, local) : null,
      name: progs.find((prog) => !DP0.test(prog)) ?? 'node',
      args: between.split(/\s+/).filter(Boolean),
    },
  };
}
