import { useIconHover } from '@animateicons/react';
import { cn } from '@/lib/utils';
import type { AnimatedIcon } from '@/lib/animatedIcon';
import { TabsTrigger } from '@/components/ui/tabs';

export default function DisplaySegmentedItem({
  value,
  label,
  icon: Icon,
  title,
  tile,
}: {
  value: string;
  label: string;
  icon?: AnimatedIcon;
  title?: string;
  tile: boolean;
}) {
  const { ref, triggerProps } = useIconHover();
  return (
    <TabsTrigger
      {...triggerProps}
      value={value}
      title={title}
      className={cn(
        'text-xs font-normal text-muted-foreground data-[state=active]:font-medium dark:data-[state=active]:bg-secondary',
        tile ? 'flex-col gap-1 py-1.5 leading-4' : 'h-6 px-2.5',
      )}
    >
      {Icon && <Icon ref={ref} size={16} />}
      {label}
    </TabsTrigger>
  );
}
