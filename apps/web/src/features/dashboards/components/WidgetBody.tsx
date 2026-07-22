import type { ProjectDetail } from '@/lib/api';
import type { WidgetInstance } from '@/utils/dashboardWidgets';
import StatWidget from './widgets/StatWidget';
import BreakdownWidget from './widgets/BreakdownWidget';
import ThroughputWidget from './widgets/ThroughputWidget';
import PulseWidget from './widgets/PulseWidget';
import RecentIssuesWidget from './widgets/RecentIssuesWidget';
import ActivityFeedWidget from './widgets/ActivityFeedWidget';
import AgentRunsWidget from './widgets/AgentRunsWidget';
import AgentHealthWidget from './widgets/AgentHealthWidget';
import WebhookHealthWidget from './widgets/WebhookHealthWidget';
import AgentWorkloadWidget from './widgets/AgentWorkloadWidget';

// The widget body for a given type. Each widget reads its own config and analytics
// query and renders a static view; its config is edited through WidgetSettings.
export default function WidgetBody({
  widget,
  projectKey,
  project,
}: {
  widget: WidgetInstance;
  projectKey: string;
  project: ProjectDetail;
}) {
  const config = widget.config ?? {};
  switch (widget.type) {
    case 'stat':
      return <StatWidget config={config} />;
    case 'breakdown':
      return <BreakdownWidget projectKey={projectKey} config={config} />;
    case 'throughput':
      return <ThroughputWidget projectKey={projectKey} config={config} />;
    case 'pulse':
      return <PulseWidget projectKey={projectKey} config={config} />;
    case 'recent_issues':
      return <RecentIssuesWidget projectKey={projectKey} config={config} />;
    case 'activity_feed':
      return <ActivityFeedWidget projectKey={projectKey} project={project} config={config} />;
    case 'agent_runs':
      return <AgentRunsWidget projectKey={projectKey} config={config} />;
    case 'agent_health':
      return <AgentHealthWidget projectKey={projectKey} config={config} />;
    case 'webhook_health':
      return <WebhookHealthWidget projectKey={projectKey} config={config} />;
    case 'agent_workload':
      return <AgentWorkloadWidget projectKey={projectKey} />;
    default:
      return null;
  }
}
