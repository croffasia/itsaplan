'use client';

import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function InitiativeFavoriteButton({
  favorite,
  disabled,
  revealOnHover = false,
  onToggle,
}: {
  favorite: boolean;
  disabled?: boolean;
  revealOnHover?: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('initiatives');
  const label = favorite ? t('removeFavorite') : t('addFavorite');

  return (
    <Button
      type="button"
      variant={favorite && !revealOnHover ? 'secondary' : 'ghost'}
      size={revealOnHover ? 'icon-xs' : 'icon-sm'}
      disabled={disabled}
      className={cn(
        revealOnHover &&
          'size-6 shrink-0 text-muted-foreground opacity-0 transition-[color,opacity] group-focus-within/item:opacity-100 group-hover/item:opacity-100',
        favorite &&
          (revealOnHover
            ? 'text-amber-500 opacity-100 hover:bg-amber-500/10 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300'
            : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/15 dark:text-amber-400'),
      )}
      aria-label={label}
      aria-pressed={favorite}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <Star className={cn(revealOnHover && 'size-3.5', favorite && 'fill-current')} />
    </Button>
  );
}
