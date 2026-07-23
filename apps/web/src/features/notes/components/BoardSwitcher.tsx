import { useState, type UIEvent } from 'react';
import { Check, ChevronsUpDown, Layers, Loader2, Lock, StickyNote } from 'lucide-react';
import type { NoteBoardSummary } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useNoteBoardSearch, flattenBoardPages } from '../services/noteBoards.service';

// Load the next page when the list is scrolled near the bottom.
const SCROLL_THRESHOLD = 48;

// The board switcher: a searchable, paged list of every board the user can see.
// Search runs on the server (filtering by name) and loads a page at a time, so the
// whole set is never fetched at once. Selecting a board hands its id to the host,
// which loads the board fresh.
export default function BoardSwitcher({
  projectKey,
  activeBoardId,
  onSelect,
}: {
  projectKey: string;
  activeBoardId: number | null;
  onSelect: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 250);
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useNoteBoardSearch(
    projectKey,
    debounced,
  );

  const boards = flattenBoardPages(data?.pages);
  const publicBoards = boards.filter((b) => !b.ownerUserId);
  const personalBoards = boards.filter((b) => b.ownerUserId);

  function onScroll(e: UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD) {
      if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
    }
  }

  function select(id: number) {
    onSelect(id);
    setOpen(false);
  }

  const renderRow = (b: NoteBoardSummary) => (
    <CommandItem key={b.id} value={`board-${b.id}`} onSelect={() => select(b.id)}>
      {b.ownerUserId ? <Lock className="size-3.5" /> : <StickyNote className="size-3.5" />}
      <span className="truncate">{b.name}</span>
      {b.id === activeBoardId && <Check className="ml-auto size-3.5" />}
    </CommandItem>
  );

  return (
    <Popover
      // Modal so a click on the React Flow canvas (which captures pointer events)
      // reliably dismisses the switcher instead of being swallowed by the canvas.
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setQuery('');
      }}
    >
      <PopoverTrigger
        aria-label="All boards"
        className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Layers className="size-3.5" />
        <span className="hidden sm:inline">All boards</span>
        <ChevronsUpDown className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search boards…" value={query} onValueChange={setQuery} />
          <CommandList onScroll={onScroll}>
            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : (
              <>
                <CommandEmpty>No boards found.</CommandEmpty>
                {publicBoards.length > 0 && (
                  <CommandGroup heading="Public">{publicBoards.map(renderRow)}</CommandGroup>
                )}
                {personalBoards.length > 0 && (
                  <CommandGroup heading="Personal">{personalBoards.map(renderRow)}</CommandGroup>
                )}
                {isFetchingNextPage && (
                  <div className="flex items-center justify-center py-2 text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                  </div>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
