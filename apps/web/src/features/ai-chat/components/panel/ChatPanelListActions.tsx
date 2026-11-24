import { Pencil, Star, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// What is done with a conversation from its row in the list.
export function ChatPanelListActions({
  favorite,
  onRename,
  onToggleFavorite,
  onDelete,
}: {
  favorite: boolean;
  onRename: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('aiChat');
  const actions = [
    { label: t('renameThread'), icon: Pencil, run: onRename },
    {
      label: t(favorite ? 'removeFavorite' : 'addFavorite'),
      icon: Star,
      run: onToggleFavorite,
      className: favorite && 'fill-current text-amber-500',
    },
    { label: t('deleteThread'), icon: Trash2, run: onDelete },
  ];

  return actions.map(({ label, icon: Icon, run, className }) => (
    <Button
      key={label}
      variant="ghost"
      size="icon"
      title={label}
      onClick={run}
      className="size-7 text-muted-foreground hover:bg-background hover:text-foreground"
    >
      <Icon className={cn('size-3.5', className)} />
      <span className="sr-only">{label}</span>
    </Button>
  ));
}
