import { File, Folder, Link2, Loader2 } from 'lucide-react';
import type { RemoteSearch } from '@/lib/api';
import { formatBytes } from '../utils/servers';

const ICON = { dir: Folder, file: File, link: Link2 } as const;

export default function ServerFileSearchResults({
  search,
  loading,
  failed,
  onOpenDirectory,
}: {
  search: RemoteSearch | undefined;
  loading: boolean;
  failed: boolean;
  onOpenDirectory: (directory: string) => void;
}) {
  if (loading) {
    return (
      <p className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Walking the directories on the server…
      </p>
    );
  }
  if (failed) {
    return <p className="px-3 py-4 text-xs text-muted-foreground">The search could not run.</p>;
  }
  if (!search || search.entries.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-muted-foreground">
        Nothing matched under this directory.
      </p>
    );
  }

  return (
    <>
      {search.truncated && (
        <p className="border-b px-3 py-1.5 text-xs text-muted-foreground">
          Showing the first matches. Search inside a narrower directory for the rest.
        </p>
      )}
      <ul>
        {search.entries.map((entry) => {
          const Icon = ICON[entry.kind];
          return (
            <li key={`${entry.directory}/${entry.name}`}>
              <button
                type="button"
                onClick={() => onOpenDirectory(entry.directory)}
                className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent/60"
                title={`Open ${entry.directory}`}
              >
                <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono">{entry.name}</span>
                  <span className="block truncate text-muted-foreground">{entry.directory}</span>
                </span>
                {entry.kind !== 'dir' && (
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {formatBytes(entry.size)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
