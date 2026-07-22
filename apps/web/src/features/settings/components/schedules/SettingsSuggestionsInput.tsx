import { useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface InputSuggestion {
  value: string;
  label: string;
  description?: ReactNode;
}

interface SuggestionsInputProps extends Omit<
  ComponentProps<typeof InputGroupInput>,
  'value' | 'onChange'
> {
  value: string;
  suggestions: InputSuggestion[];
  onValueChange: (value: string) => void;
  triggerLabel?: string;
}

export function SettingsSuggestionsInput({
  value,
  suggestions,
  onValueChange,
  triggerLabel = 'Show suggestions',
  ...inputProps
}: SuggestionsInputProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const query = value.trim().toLowerCase();
  const hasExactMatch = suggestions.some((suggestion) => suggestion.value.toLowerCase() === query);
  const matches =
    showAll || hasExactMatch
      ? suggestions
      : suggestions.filter((suggestion) => matchesQuery(suggestion, query));
  const isOpen = open && matches.length > 0;

  function choose(suggestion: InputSuggestion) {
    onValueChange(suggestion.value);
    setOpen(false);
    setShowAll(false);
  }

  return (
    <Popover
      open={isOpen}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setShowAll(false);
      }}
    >
      <PopoverAnchor asChild>
        <InputGroup aria-invalid={inputProps['aria-invalid']}>
          <InputGroupInput
            {...inputProps}
            ref={inputRef}
            value={value}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls={listId}
            aria-activedescendant={isOpen ? `${listId}-${activeIndex}` : undefined}
            onChange={(event) => {
              onValueChange(event.target.value);
              setActiveIndex(0);
              setShowAll(false);
              setOpen(true);
            }}
            onFocus={() => {
              setActiveIndex(0);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && matches.length > 0) {
                event.preventDefault();
                setOpen(true);
                setActiveIndex((index) => (isOpen ? (index + 1) % matches.length : 0));
              } else if (event.key === 'ArrowUp' && matches.length > 0) {
                event.preventDefault();
                setOpen(true);
                setActiveIndex((index) =>
                  isOpen ? (index - 1 + matches.length) % matches.length : matches.length - 1,
                );
              } else if (event.key === 'Enter' && isOpen) {
                const suggestion = matches[activeIndex];
                if (suggestion) {
                  event.preventDefault();
                  choose(suggestion);
                }
              } else if (event.key === 'Escape') {
                setOpen(false);
                setShowAll(false);
              }
            }}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              size="icon-xs"
              aria-label={triggerLabel}
              aria-expanded={isOpen}
              aria-controls={listId}
              aria-haspopup="listbox"
              onClick={() => {
                if (isOpen) {
                  setOpen(false);
                  setShowAll(false);
                  return;
                }
                setActiveIndex(0);
                setShowAll(true);
                setOpen(true);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
            >
              <ChevronDownIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </PopoverAnchor>
      <PopoverContent
        id={listId}
        role="listbox"
        align="start"
        className="w-(--radix-popover-trigger-width) p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          // The input and its trigger live in the anchor, outside the popup. Keep the
          // popover open when they are clicked or focused; those elements manage open state.
          const target = event.detail.originalEvent.target as Element | null;
          if (
            target?.closest('[data-slot="input-group"]') ===
            inputRef.current?.closest('[data-slot="input-group"]')
          ) {
            event.preventDefault();
          }
        }}
      >
        {matches.map((suggestion, index) => (
          <button
            key={suggestion.value}
            id={`${listId}-${index}`}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            className={cn(
              'flex w-full items-center justify-between gap-4 rounded-sm px-2 py-1.5 text-left text-sm outline-none',
              index === activeIndex && 'bg-accent text-accent-foreground',
            )}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(suggestion)}
          >
            <span>{suggestion.label}</span>
            {suggestion.description && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {suggestion.description}
              </span>
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function matchesQuery(suggestion: InputSuggestion, query: string) {
  return (
    suggestion.label.toLowerCase().includes(query) ||
    suggestion.value.toLowerCase().includes(query) ||
    (typeof suggestion.description === 'string' &&
      suggestion.description.toLowerCase().includes(query))
  );
}
