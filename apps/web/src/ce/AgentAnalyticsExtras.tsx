'use client';

import type { AgentAnalyticsScope } from '@/lib/api/endpoints/agentAnalytics';
import AgentAnalyticsPreview from '@/features/agent-analytics/components/AgentAnalyticsPreview';

// Below the panels of an agent dashboard, over the scope and the window it shows. Here a
// preview of the panels a build adds there; the build renders the panels themselves.
export default function AgentAnalyticsExtras(_props: { scope: AgentAnalyticsScope; days: number }) {
  return <AgentAnalyticsPreview />;
}
