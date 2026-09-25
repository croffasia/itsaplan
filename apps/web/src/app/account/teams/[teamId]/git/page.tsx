import TeamGitSection from '@/features/teams/components/integrations/TeamGitSection';

export default async function Page({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  return <TeamGitSection teamId={Number(teamId)} />;
}
