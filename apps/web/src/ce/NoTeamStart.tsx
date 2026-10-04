'use client';

import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import StartEmpty from '@/components/layout/StartEmpty';

// The start page of an account with no team and no workspace it owns, which happens while
// personal workspaces are off: a workspace owner adds people to teams.
export default function NoTeamStart() {
  const t = useTranslations('shell');
  return <StartEmpty icon={<Users />} title={t('noTeamsTitle')} hint={t('noTeamsMemberHint')} />;
}
