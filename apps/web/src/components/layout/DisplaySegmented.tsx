import { cn } from '@/lib/utils';
import type { AnimatedIcon } from '@/lib/animatedIcon';
import { Tabs, TabsList } from '@/components/ui/tabs';
import DisplaySegmentedItem from '@/components/layout/DisplaySegmentedItem';

// Options with icons render as tiles (the layout switcher); plain options as a
// compact strip.
export default function DisplaySegmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: AnimatedIcon; title?: string }[];
}) {
  const tiles = options.some((o) => o.icon);
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)}>
      <TabsList
        className={cn(
          'h-auto bg-foreground/[0.04] p-0.5',
          tiles && 'grid w-full auto-cols-[minmax(max-content,1fr)] grid-flow-col',
        )}
      >
        {options.map((o) => (
          <DisplaySegmentedItem key={o.value} {...o} tile={tiles} />
        ))}
      </TabsList>
    </Tabs>
  );
}
