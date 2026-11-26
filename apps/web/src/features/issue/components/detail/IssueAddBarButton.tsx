import { type ComponentProps } from 'react';
import { useIconHover } from '@animateicons/react';
import type { AnimatedIcon } from '@/lib/animatedIcon';
import { Button } from '@/components/ui/button';

// One entry of the issue's add bar; hovering it plays its icon. The remaining props
// are spread so a dropdown trigger can hand the button its handlers and ref.
export default function IssueAddBarButton({
  icon: Icon,
  children,
  ...props
}: { icon: AnimatedIcon } & ComponentProps<typeof Button>) {
  const { ref, triggerProps } = useIconHover();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 px-2 text-[13px] font-normal text-muted-foreground/70 hover:text-foreground"
      {...props}
      {...triggerProps}
    >
      <Icon ref={ref} size={16} />
      {children}
    </Button>
  );
}
