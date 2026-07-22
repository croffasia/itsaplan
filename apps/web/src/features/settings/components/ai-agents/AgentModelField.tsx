import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import type { ProviderModel } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Model picker for an agent: a searchable list of the selected provider's models
// (from the models.dev registry) that also accepts a model id typed by hand, so a
// custom or unlisted model still works. Disabled until a provider is chosen.
export default function AgentModelField({
  value,
  onChange,
  models,
  loading,
  disabled,
}: {
  value: string;
  onChange: (model: string) => void;
  models: ProviderModel[];
  loading: boolean;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const select = (model: string) => {
    onChange(model);
    setSearch('');
    setOpen(false);
  };

  const query = search.trim();
  // Offer the typed text as a custom model id when it does not match a known one.
  const showCustom = query.length > 0 && !models.some((m) => m.id === query);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={value ? 'truncate' : 'truncate text-muted-foreground'}>
            {value || 'Choose a model'}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search or type a model id"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList
            className="max-h-[16rem]"
            // The field lives inside a Radix Sheet whose scroll lock blocks wheel
            // events on this portaled list, so scroll it manually on wheel.
            onWheel={(e) => {
              e.currentTarget.scrollTop += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
            }}
          >
            {!loading && !showCustom && <CommandEmpty>No models found.</CommandEmpty>}
            {loading && (
              <div className="px-3 py-2 text-sm text-muted-foreground">Loading models…</div>
            )}
            {showCustom && (
              <CommandGroup>
                <CommandItem value={query} onSelect={() => select(query)}>
                  Use &quot;{query}&quot;
                </CommandItem>
              </CommandGroup>
            )}
            {models.length > 0 && (
              <CommandGroup>
                {models.map((m) => (
                  <CommandItem key={m.id} value={`${m.id} ${m.name}`} onSelect={() => select(m.id)}>
                    <span className="flex-1 truncate">
                      <span className="font-mono text-xs">{m.id}</span>
                      {m.name !== m.id && (
                        <span className="ml-2 text-muted-foreground">{m.name}</span>
                      )}
                    </span>
                    {value === m.id && <Check className="ml-auto size-4" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
