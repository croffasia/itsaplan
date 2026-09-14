import { Button } from '@/components/ui/button';
import type { BraindumpKind } from '@/lib/api';
import { KIND_META } from '../utils/braindump';

const ORDER: BraindumpKind[] = ['idea', 'task', 'note', 'voice'];

export default function BraindumpKindPicker({
  value,
  onChange,
}: {
  value: BraindumpKind;
  onChange: (kind: BraindumpKind) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ORDER.map((kind) => {
        const meta = KIND_META[kind];
        const active = kind === value;
        return (
          <Button
            key={kind}
            type="button"
            size="sm"
            variant={active ? 'secondary' : 'ghost'}
            aria-pressed={active}
            className="h-7 rounded-full px-3 text-xs font-normal"
            onClick={() => onChange(kind)}
          >
            <meta.icon className="size-3.5" />
            {meta.label}
          </Button>
        );
      })}
    </div>
  );
}
