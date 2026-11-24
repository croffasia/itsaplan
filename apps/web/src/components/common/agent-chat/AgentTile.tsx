import { Bot, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// An agent's mark: next to its answer, and larger in a list, where it turns while the agent
// is answering.
export default function AgentTile({
  size = 'sm',
  working = false,
  className,
}: {
  size?: 'sm' | 'lg';
  working?: boolean;
  className?: string;
}) {
  const Icon = working ? LoaderCircle : Bot;
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center bg-muted text-foreground',
        size === 'lg' ? 'size-8 rounded-lg' : 'size-5 rounded-md',
        className,
      )}
    >
      <Icon
        className={cn(
          size === 'lg' ? 'size-4' : 'size-3',
          working && 'animate-spin motion-reduce:animate-none',
        )}
      />
    </span>
  );
}
