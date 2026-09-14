import SidebarAiTeamNav from '@/components/layout/SidebarAiTeamNav';
import SidebarConfigNav from '@/components/layout/SidebarConfigNav';
import SidebarGrowthNav from '@/components/layout/SidebarGrowthNav';
import SidebarIntelligenceNav from '@/components/layout/SidebarIntelligenceNav';
import SidebarWorkNav from '@/components/layout/SidebarWorkNav';

export default function SidebarMainNav({
  projectKey,
  projectId,
}: {
  projectKey: string | null;
  projectId: number | null;
}) {
  return (
    <>
      <SidebarWorkNav projectKey={projectKey} projectId={projectId} />
      <SidebarIntelligenceNav projectKey={projectKey} />
      <SidebarGrowthNav projectKey={projectKey} />
      <SidebarAiTeamNav projectKey={projectKey} />
      <SidebarConfigNav projectKey={projectKey} />
    </>
  );
}
