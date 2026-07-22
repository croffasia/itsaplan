import { Fragment, useEffect, useState } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useIssueSearchQuery } from '@/services/issues.service';
import type { Command, CommandPage, CommandSection } from '@/utils/commands';
import { substringFilter } from '@/utils/commandFilter';
import CommandPaletteIssues from '@/components/layout/CommandPaletteIssues';
import CommandPaletteRow from '@/components/layout/CommandPaletteRow';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

// Command palette (⌘K). Renders the sections it is given, in order: the commands
// for the issue in front of the user, then the board, the general commands, the
// project list and every section they may open. A command with a submenu opens a
// second level (status, priority, assignee, labels); Backspace on an empty input
// goes back. While the user is typing, a last "Issues" group lists issues the
// server matches by identifier, title, description, number or custom fields
// (archived issues included), so a search separates sections, commands and issues.
export default function CommandPalette({
  open,
  onOpenChange,
  sections,
  currentProjectKey,
  hasProject,
  onOpenIssue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: CommandSection[];
  currentProjectKey: string | null;
  hasProject: boolean;
  onOpenIssue: (sequenceNumber: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<CommandPage | null>(null);

  // Reset the query and the open submenu whenever the palette closes, so it
  // reopens at the top level and empty.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setPage(null);
    }
  }, [open]);

  // Scroll the results back to the top on every query change; otherwise the list
  // keeps its previous scroll offset and a match can land mid-list out of view.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const list = document.querySelector('[data-slot="command-list"]');
      if (list) list.scrollTop = 0;
    });
    return () => cancelAnimationFrame(id);
  }, [query, page]);

  // Debounce the input before it drives the search request, so a burst of
  // keystrokes issues one query, not one per character.
  const debounced = useDebouncedValue(query, 250);
  const search = useIssueSearchQuery(currentProjectKey, debounced, { enabled: open && !page });
  const hits = search.data ?? [];
  const searching = query.trim().length > 0;

  function run(command: Command) {
    if (command.submenu) {
      setPage(command.submenu);
      setQuery('');
      return;
    }
    if (!command.keepOpen) onOpenChange(false);
    command.run?.();
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} filter={substringFilter}>
      <CommandInput
        placeholder={page ? page.placeholder : 'Type a command or search…'}
        value={query}
        onValueChange={setQuery}
        // Backspace on an empty input leaves the submenu, the way a nested menu
        // closes with the left arrow.
        onKeyDown={(e) => {
          if (page && e.key === 'Backspace' && query === '') {
            e.preventDefault();
            setPage(null);
          }
        }}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {page ? (
          <CommandGroup heading={page.heading}>
            {page.items.map((command) => (
              <CommandPaletteRow key={command.id} command={command} onRun={run} />
            ))}
          </CommandGroup>
        ) : (
          sections.map((section, i) => (
            <Fragment key={section.id}>
              {i > 0 && <CommandSeparator />}
              <CommandGroup heading={section.heading}>
                {section.items.map((command) => (
                  <CommandPaletteRow key={command.id} command={command} onRun={run} />
                ))}
              </CommandGroup>
            </Fragment>
          ))
        )}
        {/* Issue results only appear while the user is typing, otherwise the
            palette would list the entire project on open. */}
        {!page && hasProject && searching && (hits.length > 0 || search.isFetching) && (
          <CommandPaletteIssues
            hits={hits}
            fetching={search.isFetching}
            onOpenIssue={(seq) => {
              onOpenChange(false);
              onOpenIssue(seq);
            }}
          />
        )}
      </CommandList>
    </CommandDialog>
  );
}
