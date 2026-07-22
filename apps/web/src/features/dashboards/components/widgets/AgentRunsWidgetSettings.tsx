import type { WidgetConfig } from '@/utils/dashboardWidgets';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { STATUS_FILTER } from './AgentRunsWidget';
import LimitSelect from './LimitSelect';

// The run status filter and the row count.
export default function AgentRunsWidgetSettings({
  config,
  onConfigChange,
}: {
  config: WidgetConfig;
  onConfigChange: (config: WidgetConfig) => void;
}) {
  const status = config.runStatus ?? null;
  const limit = config.limit ?? 20;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={status ?? 'all'}
        onValueChange={(v) =>
          onConfigChange({ runStatus: v === 'all' ? null : (v as WidgetConfig['runStatus']) })
        }
      >
        <SelectTrigger size="sm" className="w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_FILTER.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <LimitSelect value={limit} onChange={(next) => onConfigChange({ limit: next })} />
    </div>
  );
}
