import {
  Activity,
  BarChart3,
  Bot,
  CalendarDays,
  Hash,
  ListChecks,
  PieChart,
  Users,
  Webhook,
  type LucideIcon,
} from 'lucide-react';
import type { WidgetType } from '@/utils/dashboardWidgets';

// The icon of each widget type, shown in the add-widget picker. Kept in the
// feature (it carries lucide icon components) separate from the pure layout types
// in @/utils/dashboardWidgets. The label and description of a type are messages
// under `dashboards.widgets`.
export const WIDGET_ICON: Record<WidgetType, LucideIcon> = {
  stat: Hash,
  recent_issues: ListChecks,
  activity_feed: Activity,
  pulse: CalendarDays,
  throughput: BarChart3,
  breakdown: PieChart,
  agent_runs: Bot,
  agent_health: Activity,
  webhook_health: Webhook,
  agent_workload: Users,
};

// Widget types grouped by subject for the add-widget picker. The picker renders one
// section per group, in this order.
export const WIDGET_GROUPS: { key: 'issues' | 'agents'; types: WidgetType[] }[] = [
  {
    key: 'issues',
    types: ['stat', 'breakdown', 'throughput', 'pulse', 'recent_issues', 'activity_feed'],
  },
  {
    key: 'agents',
    types: ['agent_runs', 'agent_health', 'webhook_health', 'agent_workload'],
  },
];
