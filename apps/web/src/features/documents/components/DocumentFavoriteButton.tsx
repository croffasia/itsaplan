'use client';

import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function DocumentFavoriteButton({
  favorite,
  disabled,
  onChange,
}: {
  favorite: boolean;
  disabled: boolean;
  onChange: (favorite: boolean) => void;
}) {
  const t = useTranslations('documents');
  const label = favorite ? t('removeFavorite') : t('addFavorite');

  return (
    <Button
      type="button"
      variant={favorite ? 'secondary' : 'ghost'}
      size="icon-sm"
      disabled={disabled}
      className={cn(
        favorite && 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/15 dark:text-amber-400',
      )}
      aria-label={label}
      aria-pressed={favorite}
      title={label}
      onClick={() => onChange(!favorite)}
    >
      <Star className={cn(favorite && 'fill-current')} />
    </Button>
  );
}
