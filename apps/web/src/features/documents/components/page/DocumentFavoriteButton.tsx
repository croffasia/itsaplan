'use client';

import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import DocumentIconButton from '../DocumentIconButton';

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

  return (
    <DocumentIconButton
      label={favorite ? t('removeFavorite') : t('addFavorite')}
      aria-pressed={favorite}
      disabled={disabled}
      className={cn(favorite && 'text-warning hover:text-warning aria-pressed:text-warning')}
      onClick={() => onChange(!favorite)}
    >
      <Star className={cn(favorite && 'fill-current')} />
    </DocumentIconButton>
  );
}
