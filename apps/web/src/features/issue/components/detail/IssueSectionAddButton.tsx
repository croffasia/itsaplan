import { type ComponentProps } from 'react';
import { useIconHover } from '@animateicons/react';
import { PlusIcon } from '@animateicons/react/lucide/plus-icon';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// The add control at the end of a section heading; hovering it plays its icon. The
// remaining props are spread so a dropdown trigger can hand the button its handlers
// and ref.
export default function IssueSectionAddButton({
  label,
  busy,
  ...props
}: { label: string; busy?: boolean } & ComponentProps<typeof Button>) {
  const { ref, triggerProps } = useIconHover();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground/70 hover:text-foreground"
      title={label}
      aria-label={label}
      {...props}
      {...triggerProps}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <PlusIcon ref={ref} size={16} />}
    </Button>
  );
}
