import { redirect } from 'next/navigation';
import { aiTeamPath, projectRefOf } from '@/utils/paths';
import { AI_TEAM_SECTIONS } from '@/utils/settingsSections';

// The chat is a panel now, so its old path has no page of its own and sends the
// viewer to the first AI Team section.
export default async function Page({
  params,
}: {
  params: Promise<{ teamRef: string; projectKey: string }>;
}) {
  const { teamRef, projectKey } = await params;
  redirect(aiTeamPath(projectRefOf(teamRef, projectKey), AI_TEAM_SECTIONS[0].slug));
}
