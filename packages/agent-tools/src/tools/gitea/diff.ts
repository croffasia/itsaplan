// Splits a pull request's unified diff, as `git diff` writes it, into one entry per file.
// Gitea runs git with core.quotePath off, so a path is quoted only when it holds a quote,
// a backslash or a control character.

export interface FileDiff {
  path: string;
  previousPath: string | null;
  status: 'added' | 'deleted' | 'renamed' | 'modified';
  additions: number;
  deletions: number;
  patch: string | null;
}

function unquote(path: string): string {
  if (!path.startsWith('"')) return path;
  try {
    return JSON.parse(path) as string;
  } catch {
    return path.slice(1, -1);
  }
}

function strip(path: string, prefix: 'a/' | 'b/'): string {
  const value = unquote(path);
  return value.startsWith(prefix) ? value.slice(2) : value;
}

// The path in a "diff --git a/P b/P" header, read only when no other line names it: an
// empty new file, a binary file, a mode change. The two halves are the same path then.
function headerPath(header: string): string {
  if (header.startsWith('"')) return strip(header.slice(0, header.indexOf('" ') + 1), 'a/');
  return header.slice(2, 2 + (header.length - 5) / 2);
}

export function splitDiff(diff: string): FileDiff[] {
  return diff
    .split(/^diff --git /m)
    .slice(1)
    .map((section) => {
      const lines = section.replace(/\n$/, '').split('\n');
      let oldPath: string | null = null;
      let newPath: string | null = null;
      let status: FileDiff['status'] = 'modified';
      let start = lines.findIndex((line) => line.startsWith('@@'));
      if (start < 0) start = lines.length;
      for (const line of lines.slice(1, start)) {
        if (line.startsWith('new file mode')) status = 'added';
        else if (line.startsWith('deleted file mode')) status = 'deleted';
        else if (line.startsWith('rename from ')) {
          status = 'renamed';
          oldPath = unquote(line.slice(12));
        } else if (line.startsWith('rename to ')) newPath = unquote(line.slice(10));
        else if (line.startsWith('--- ') && line !== '--- /dev/null') {
          oldPath = strip(line.slice(4), 'a/');
        } else if (line.startsWith('+++ ') && line !== '+++ /dev/null') {
          newPath = strip(line.slice(4), 'b/');
        }
      }
      const hunks = lines.slice(start);
      const path = newPath ?? oldPath ?? headerPath(lines[0] ?? '');
      return {
        path,
        previousPath: status === 'renamed' ? oldPath : null,
        status,
        additions: hunks.filter((line) => line.startsWith('+')).length,
        deletions: hunks.filter((line) => line.startsWith('-')).length,
        patch: hunks.length ? hunks.join('\n') : null,
      };
    });
}
