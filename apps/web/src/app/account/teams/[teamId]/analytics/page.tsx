import TeamAgentAnalyticsSection from '@/features/agent-analytics/TeamAgentAnalyticsSection';

export default async function Page({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  return <TeamAgentAnalyticsSection teamId={Number(teamId)} />;
}
