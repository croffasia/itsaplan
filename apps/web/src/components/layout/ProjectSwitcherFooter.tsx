import Link from 'next/link';
import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { manageTeamsPath } from '@/utils/paths';
import { Button } from '@/components/ui/button';

export default function ProjectSwitcherFooter({ onClose }: { onClose: () => void }) {
  const t = useTranslations('nav');

  return (
    <div className="flex shrink-0 flex-wrap gap-1 border-t p-1">
      <Button asChild variant="ghost" size="sm" className="flex-1 justify-start">
        <Link href={manageTeamsPath()} onClick={onClose}>
          <Users />
          {t('manageTeams')}
        </Link>
      </Button>
    </div>
  );
}
