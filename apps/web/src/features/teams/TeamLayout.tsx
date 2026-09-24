'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { manageTeamsPath } from '@/utils/paths';
import { useTeamsQuery } from '@/services/teams.service';
import TeamsPageRail from './components/TeamsPageRail';
import TeamSectionNav from './components/TeamSectionNav';
import { useRouteTeam } from './hooks/useRouteTeam';

// One team, as the second rail of the page and the section open beside it. Each
// section is a route of its own and loads only what it shows. A path that names the
// team by its id moves to its slug, and a team the account is no longer in falls back
// to the first one left.
export default function TeamLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data } = useTeamsQuery();
  const team = useRouteTeam();

  useEffect(() => {
    if (data && !team) router.replace(manageTeamsPath());
    const [, routed = '', ...rest] = pathname.split('/');
    if (team && decodeURIComponent(routed) !== team.ref) {
      router.replace(`/${encodeURIComponent(team.ref)}/${rest.join('/')}`);
    }
  }, [data, team, pathname, router]);

  return (
    <>
      <TeamsPageRail className="lg:w-60">{team && <TeamSectionNav team={team} />}</TeamsPageRail>
      <div className="flex min-w-0 flex-1 flex-col">{team && children}</div>
    </>
  );
}
