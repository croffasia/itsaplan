import path from 'node:path';
import { Client, type FileEntry, type SFTPWrapper } from 'ssh2';
import { CONNECT_TIMEOUT_MS, hostKeyFingerprint } from './ssh';
import type { ServerCredential } from './store';

// Reading a directory and a handful of counters both need a short-lived
// connection. A session is not pooled: the handshake costs a moment, and holding
// SSH connections open to customer machines between requests is not worth that.
const COMMAND_TIMEOUT_MS = 20_000;

function connect(credential: ServerCredential): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    client.on('ready', () => resolve(client));
    client.on('error', (error) => reject(error));
    client.connect({
      host: credential.host,
      port: credential.port,
      username: credential.username,
      ...(credential.authType === 'password'
        ? { password: credential.secret }
        : {
            privateKey: credential.secret,
            ...(credential.passphrase ? { passphrase: credential.passphrase } : {}),
          }),
      readyTimeout: CONNECT_TIMEOUT_MS,
      hostVerifier: (key: Buffer) => {
        // The same rule as the terminal: a host whose key does not match the pin
        // never receives the credential.
        if (!credential.hostKeyFingerprint) return true;
        return hostKeyFingerprint(key) === credential.hostKeyFingerprint;
      },
    });
  });
}

function exec(client: Client, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('command timed out')), COMMAND_TIMEOUT_MS);
    client.exec(command, (error, stream) => {
      if (error) {
        clearTimeout(timer);
        reject(error);
        return;
      }
      let out = '';
      stream.on('data', (chunk: Buffer) => {
        out += chunk.toString();
      });
      stream.on('close', () => {
        clearTimeout(timer);
        resolve(out);
      });
    });
  });
}

export interface RemoteFile {
  name: string;
  kind: 'dir' | 'file' | 'link';
  size: number;
  modifiedAt: string | null;
}

// The listing is done over SFTP, not by running `ls`: it is a protocol call with
// the path as an argument, so nothing here can turn into a shell command. The
// remote account's own permissions still decide what is readable.
export async function listDirectory(
  credential: ServerCredential,
  requested: string,
): Promise<{ path: string; entries: RemoteFile[] }> {
  const target = path.posix.normalize(requested.startsWith('/') ? requested : `/${requested}`);
  const client = await connect(credential);
  try {
    const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
      client.sftp((error, handle) => (error ? reject(error) : resolve(handle)));
    });
    const entries = await new Promise<RemoteFile[]>((resolve, reject) => {
      sftp.readdir(target, (error, list) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(
          list.map((item) => ({
            name: item.filename,
            kind: item.longname.startsWith('d')
              ? ('dir' as const)
              : item.longname.startsWith('l')
                ? ('link' as const)
                : ('file' as const),
            size: item.attrs.size,
            modifiedAt: item.attrs.mtime ? new Date(item.attrs.mtime * 1000).toISOString() : null,
          })),
        );
      });
    });
    entries.sort((a, b) => {
      if (a.kind === 'dir' && b.kind !== 'dir') return -1;
      if (b.kind === 'dir' && a.kind !== 'dir') return 1;
      return a.name.localeCompare(b.name);
    });
    return { path: target, entries };
  } finally {
    client.end();
  }
}

export interface FoundFile extends RemoteFile {
  // The directory the match sits in, so the browser can jump straight to it.
  directory: string;
}

// Directories that are kernel or device state rather than files. Walking them is
// pointless and slow, and /proc in particular is effectively bottomless.
const SKIPPED = new Set(['/proc', '/sys', '/dev', '/run']);

const SEARCH_MAX_DEPTH = 6;
const SEARCH_MAX_RESULTS = 200;
const SEARCH_MAX_DIRS = 400;
const SEARCH_TIME_BUDGET_MS = 15_000;

// Walks the tree under `root` over SFTP and returns the entries whose name
// contains `query`. Deliberately not `find`: the term would have to be quoted into
// a shell command, and nothing typed in a browser should ever reach a shell on a
// customer's machine. The walk is bounded in depth, breadth, results and time, so
// a search on / cannot run away.
export async function searchDirectory(
  credential: ServerCredential,
  root: string,
  query: string,
): Promise<{ path: string; entries: FoundFile[]; truncated: boolean }> {
  const needle = query.trim().toLowerCase();
  const start = path.posix.normalize(root.startsWith('/') ? root : `/${root}`);
  if (needle.length === 0) return { path: start, entries: [], truncated: false };

  const client = await connect(credential);
  const deadline = Date.now() + SEARCH_TIME_BUDGET_MS;
  const found: FoundFile[] = [];
  let visited = 0;
  let truncated = false;

  try {
    const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
      client.sftp((error, handle) => (error ? reject(error) : resolve(handle)));
    });

    const queue: { dir: string; depth: number }[] = [{ dir: start, depth: 0 }];
    while (queue.length > 0) {
      if (
        Date.now() > deadline ||
        found.length >= SEARCH_MAX_RESULTS ||
        visited >= SEARCH_MAX_DIRS
      ) {
        truncated = queue.length > 0;
        break;
      }
      const { dir, depth } = queue.shift()!;
      if (SKIPPED.has(dir)) continue;
      visited += 1;

      const list = await new Promise<FileEntry[]>((resolve) => {
        // A directory the account cannot read is skipped, not fatal: a search over
        // a whole disk always meets a few.
        sftp.readdir(dir, (error, items) => resolve(error ? [] : items));
      });

      for (const item of list) {
        const kind = item.longname.startsWith('d')
          ? ('dir' as const)
          : item.longname.startsWith('l')
            ? ('link' as const)
            : ('file' as const);
        const full = `${dir.replace(/\/+$/, '')}/${item.filename}`;
        if (item.filename.toLowerCase().includes(needle) && found.length < SEARCH_MAX_RESULTS) {
          found.push({
            name: item.filename,
            kind,
            size: item.attrs.size,
            modifiedAt: item.attrs.mtime ? new Date(item.attrs.mtime * 1000).toISOString() : null,
            directory: dir,
          });
        }
        // Symlinks are not followed: they loop, and a link into / would undo every
        // bound above.
        if (kind === 'dir' && depth < SEARCH_MAX_DEPTH && !SKIPPED.has(full)) {
          queue.push({ dir: full, depth: depth + 1 });
        }
      }
    }
  } finally {
    client.end();
  }

  found.sort((a, b) => a.name.localeCompare(b.name));
  return { path: start, entries: found, truncated };
}

export interface RemoteMetrics {
  hostname: string;
  os: string;
  kernel: string;
  uptimeSeconds: number;
  cpuCount: number;
  cpuPercent: number;
  loadAverage: number[];
  memoryTotalKb: number;
  memoryUsedKb: number;
  diskTotalKb: number;
  diskUsedKb: number;
}

// One fixed command, with no interpolated input anywhere. Two samples of
// /proc/stat a second apart give a real CPU percentage rather than a load-average
// approximation.
const METRICS_COMMAND = [
  'hostname',
  "echo '---'",
  'cat /proc/uptime',
  "echo '---'",
  'cat /proc/loadavg',
  "echo '---'",
  'nproc',
  "echo '---'",
  'head -3 /proc/meminfo',
  "echo '---'",
  'df -P -k /',
  "echo '---'",
  'head -1 /proc/stat; sleep 1; head -1 /proc/stat',
  "echo '---'",
  'uname -r',
  "echo '---'",
  'cat /etc/os-release 2>/dev/null | head -2',
].join('; ');

function cpuTotals(line: string): { idle: number; total: number } {
  const values = line.trim().split(/\s+/).slice(1).map(Number);
  const idle = (values[3] ?? 0) + (values[4] ?? 0);
  const total = values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  return { idle, total };
}

export async function readMetrics(credential: ServerCredential): Promise<RemoteMetrics> {
  const client = await connect(credential);
  let output: string;
  try {
    output = await exec(client, METRICS_COMMAND);
  } finally {
    client.end();
  }
  const [hostname, uptime, loadavg, nproc, meminfo, df, stat, kernel, osRelease] = output
    .split('---')
    .map((part) => part.trim());

  const mem = Object.fromEntries(
    (meminfo ?? '')
      .split('\n')
      .map((line) => line.split(':'))
      .filter((pair) => pair.length === 2)
      .map(([key, value]) => [key.trim(), Number(value.trim().replace(/[^\d]/g, '')) || 0]),
  ) as Record<string, number>;

  const dfRow = (df ?? '').split('\n')[1]?.trim().split(/\s+/) ?? [];
  const statLines = (stat ?? '').split('\n').filter((line) => line.startsWith('cpu '));
  let cpuPercent = 0;
  if (statLines.length === 2) {
    const first = cpuTotals(statLines[0]);
    const second = cpuTotals(statLines[1]);
    const totalDelta = second.total - first.total;
    const idleDelta = second.idle - first.idle;
    if (totalDelta > 0) {
      cpuPercent = Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100));
    }
  }

  const prettyName = (osRelease ?? '').match(/PRETTY_NAME="?([^"\n]+)"?/)?.[1];

  return {
    hostname: (hostname ?? '').split('\n')[0] ?? '',
    os: prettyName ?? '',
    kernel: (kernel ?? '').split('\n')[0] ?? '',
    uptimeSeconds: Math.round(Number((uptime ?? '').split(/\s+/)[0]) || 0),
    cpuCount: Number(nproc) || 0,
    cpuPercent: Math.round(cpuPercent * 10) / 10,
    loadAverage: (loadavg ?? '')
      .split(/\s+/)
      .slice(0, 3)
      .map((value) => Number(value) || 0),
    memoryTotalKb: mem.MemTotal ?? 0,
    memoryUsedKb: Math.max(0, (mem.MemTotal ?? 0) - (mem.MemAvailable ?? 0)),
    diskTotalKb: Number(dfRow[1]) || 0,
    diskUsedKb: Number(dfRow[2]) || 0,
  };
}
