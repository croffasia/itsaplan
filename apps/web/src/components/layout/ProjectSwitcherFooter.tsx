import Link from 'next/link';
import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { manageTeamsPath } from '@/utils/paths';
import { Button } from '@/components/ui/button';

const KBD = 'rounded border bg-muted px-1 font-sans text-[10px] font-medium text-muted-foreground';

export default function ProjectSwitcherFooter({
  isMobile,
  onClose,
}: {
  isMobile: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('nav');

  return (
    <div className="flex shrink-0 items-center gap-1 border-t p-1">
      <Button asChild variant="ghost" size="sm" className="flex-1 justify-start">
        <Link href={manageTeamsPath()} onClick={onClose}>
          <Users />
          {t('manageTeams')}
        </Link>
      </Button>
      {!isMobile && (
        <span
          aria-hidden
          className="flex shrink-0 items-center gap-1 pe-2 text-xs text-muted-foreground"
        >
          <kbd className={KBD}>↑</kbd>
          <kbd className={KBD}>↓</kbd>
          {t('projectPicker.hintMove')}
          <kbd className={`${KBD} ms-1.5`}>↵</kbd>
          {t('projectPicker.hintOpen')}
        </span>
      )}
    </div>
  );
}
