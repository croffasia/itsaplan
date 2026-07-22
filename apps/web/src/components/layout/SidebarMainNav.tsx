import SidebarAiTeamNav from '@/components/layout/SidebarAiTeamNav';
import SidebarConfigNav from '@/components/layout/SidebarConfigNav';
import SidebarWorkNav from '@/components/layout/SidebarWorkNav';

// The main sidebar body: the work navigation, the AI Team group, then the
// Configuration group.
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
      <SidebarAiTeamNav projectKey={projectKey} />
      <SidebarConfigNav projectKey={projectKey} />
    </>
  );
}
