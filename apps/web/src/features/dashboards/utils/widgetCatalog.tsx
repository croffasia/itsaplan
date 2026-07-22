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

// Display metadata for each widget type: shown in the add-widget picker and used
// as the fallback title on a widget with no custom title. Kept in the feature (it
// carries lucide icon components) separate from the pure layout types in
// @/utils/dashboardWidgets.
export const WIDGET_META: Record<
  WidgetType,
  { label: string; description: string; icon: LucideIcon }
> = {
  stat: {
    label: 'Number',
    description: 'Count of issues matching a filter',
    icon: Hash,
  },
  recent_issues: {
    label: 'Recent issues',
    description: 'Latest issues by created or updated time',
    icon: ListChecks,
  },
  activity_feed: {
    label: 'Activity feed',
    description: 'Project-wide change log, filterable by actor and action',
    icon: Activity,
  },
  pulse: {
    label: 'Pulse',
    description: 'GitHub-style heatmap of daily activity',
    icon: CalendarDays,
  },
  throughput: {
    label: 'Throughput',
    description: 'Created vs closed issues per week',
    icon: BarChart3,
  },
  breakdown: {
    label: 'Breakdown',
    description: 'Issue counts by status, priority, type, or assignee',
    icon: PieChart,
  },
  agent_runs: {
    label: 'Agent runs',
    description: 'Recent AI agent runs with their outcome',
    icon: Bot,
  },
  agent_health: {
    label: 'Agent health',
    description: 'Agent run success rate and failures over a window',
    icon: Activity,
  },
  webhook_health: {
    label: 'Webhook health',
    description: 'Webhook delivery outcomes and disabled endpoints',
    icon: Webhook,
  },
  agent_workload: {
    label: 'Agent workload',
    description: 'Delegated issues and run outcomes per agent',
    icon: Users,
  },
};

// Widget types grouped by subject for the add-widget picker. The picker renders one
// section per group, in this order.
export const WIDGET_GROUPS: { label: string; types: WidgetType[] }[] = [
  {
    label: 'Issues',
    types: ['stat', 'breakdown', 'throughput', 'pulse', 'recent_issues', 'activity_feed'],
  },
  {
    label: 'AI agents & webhooks',
    types: ['agent_runs', 'agent_health', 'webhook_health', 'agent_workload'],
  },
];
