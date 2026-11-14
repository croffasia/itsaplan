import { Checkbox } from '@/components/ui/checkbox';
import type { CapabilityItem } from './AgentCapabilityList';

// One checkbox row of the capability list. An enabled row names its group too, since
// it sits outside its group's heading.
export function AgentCapabilityRow({
  item,
  onToggle,
}: {
  item: CapabilityItem;
  onToggle: (ids: number[], on: boolean) => void;
}) {
  const detail = [item.checked ? item.group : undefined, item.subtitle].filter(Boolean).join(' · ');
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 ${
        item.checked ? 'bg-muted/50' : ''
      }`}
    >
      <Checkbox
        className="mt-0.5"
        checked={item.checked}
        onCheckedChange={(v) => onToggle([item.id], v === true)}
      />
      <span className="min-w-0">
        <span className="text-sm">{item.title}</span>
        {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
        {item.warning && (
          <span className="block text-xs font-medium text-warning">{item.warning}</span>
        )}
      </span>
    </label>
  );
}
