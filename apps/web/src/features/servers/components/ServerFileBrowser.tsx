'use client';

import { useState } from 'react';
import { ChevronRight, File, Folder, Link2, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatBytes } from '../utils/servers';
import ServerFileSearchResults from './ServerFileSearchResults';
import { useServerFileSearchQuery, useServerFilesQuery } from '../services/servers.service';

const ICON = { dir: Folder, file: File, link: Link2 } as const;

function parentOf(path: string): string {
  if (path === '/') return '/';
  const trimmed = path.replace(/\/+$/, '');
  return trimmed.slice(0, trimmed.lastIndexOf('/')) || '/';
}

export default function ServerFileBrowser({ serverId }: { serverId: number }) {
  const [path, setPath] = useState('/');
  const [term, setTerm] = useState('');
  // What was actually submitted. Typing filters the open directory for free;
  // pressing Enter walks the tree on the machine, which is not free.
  const [submitted, setSubmitted] = useState('');
  const query = useServerFilesQuery(serverId, path, true);
  const search = useServerFileSearchQuery(serverId, path, submitted);
  const needle = term.trim().toLowerCase();
  const entries = (query.data?.entries ?? []).filter((entry) =>
    needle.length === 0 ? true : entry.name.toLowerCase().includes(needle),
  );

  const openDirectory = (next: string) => {
    setPath(next);
    setTerm('');
    setSubmitted('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Files
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="Reload directory"
          onClick={() => void query.refetch()}
        >
          <RefreshCw className={cn('size-3.5', query.isFetching && 'animate-spin')} />
        </Button>
      </div>

      <div className="flex items-center gap-1 border-b px-3 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs font-normal"
          disabled={path === '/'}
          onClick={() => openDirectory(parentOf(path))}
        >
          Up
        </Button>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
          {query.data?.path ?? path}
        </span>
      </div>

      <div className="relative border-b px-3 py-1.5">
        <Search className="absolute top-1/2 left-5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && term.trim().length >= 2) setSubmitted(term.trim());
            if (event.key === 'Escape') {
              setTerm('');
              setSubmitted('');
            }
          }}
          placeholder="Filter here, Enter to search deeper…"
          className="h-7 pr-7 pl-7 text-xs"
        />
        {(term.length > 0 || submitted.length > 0) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-4 size-5 -translate-y-1/2"
            aria-label="Clear search"
            onClick={() => {
              setTerm('');
              setSubmitted('');
            }}
          >
            <X className="size-3" />
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {submitted.length > 0 ? (
          <ServerFileSearchResults
            search={search.data}
            loading={search.isLoading}
            failed={search.isError}
            onOpenDirectory={openDirectory}
          />
        ) : query.isLoading ? (
          <p className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Opening a connection…
          </p>
        ) : query.isError ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">
            Could not read this directory. The account may not have access to it.
          </p>
        ) : entries.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">
            {needle.length > 0
              ? 'Nothing here matches. Press Enter to search the directories below this one.'
              : 'This directory is empty.'}
          </p>
        ) : (
          <ul>
            {entries.map((entry) => {
              const Icon = ICON[entry.kind];
              const isDir = entry.kind === 'dir';
              return (
                <li key={entry.name}>
                  <button
                    type="button"
                    disabled={!isDir}
                    onClick={() =>
                      openDirectory(
                        `${path.replace(/\/+$/, '')}/${entry.name}`.replace(/\/+/g, '/'),
                      )
                    }
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs',
                      isDir ? 'hover:bg-accent/60' : 'cursor-default',
                    )}
                  >
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-mono">{entry.name}</span>
                    {!isDir && (
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {formatBytes(entry.size)}
                      </span>
                    )}
                    {isDir && <ChevronRight className="size-3 shrink-0 text-muted-foreground" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
