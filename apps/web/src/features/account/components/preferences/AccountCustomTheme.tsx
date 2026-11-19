'use client';

import { useEffect, useState } from 'react';
import { ClipboardPaste, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatCustomTheme, parseCustomTheme } from '@/utils/colorThemes';
import type { CustomTheme } from '@/utils/customTheme';
import AccountCustomThemeColor from './AccountCustomThemeColor';
import AccountPreferenceRow from './AccountPreferenceRow';

// The fields of a custom palette. Edits go to a local draft that saves once it stops
// changing for a moment, so dragging through a color picker sends one request.
export default function AccountCustomTheme({
  theme,
  onChange,
}: {
  theme: CustomTheme;
  onChange: (theme: CustomTheme) => void;
}) {
  const t = useTranslations('account.preferences');
  const tTransfer = useTranslations('settings.transfer');
  // Starts from the saved palette and is not reset by later saves: a save that lands
  // while the user is still dragging would pull the picker back.
  const [draft, setDraft] = useState(theme);
  const settled = useDebouncedValue(draft, 400);
  const edit = (patch: Partial<CustomTheme>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    if (formatCustomTheme(settled) !== formatCustomTheme(theme)) onChange(settled);
    // Only a settled edit saves; theme and onChange change with every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatCustomTheme(draft));
      toast.success(t('paletteCopied'));
    } catch {
      toast.error(tTransfer('copyFailed'));
    }
  };

  const paste = async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      toast.error(tTransfer('readFailed'));
      return;
    }
    const pasted = parseCustomTheme(text);
    if (!pasted) {
      toast.error(t('pastePaletteInvalid'));
      return;
    }
    setDraft(pasted);
    toast.success(t('palettePasted'));
  };

  return (
    <>
      <AccountPreferenceRow label={t('accent')} description={t('accentDescription')}>
        <AccountCustomThemeColor
          label={t('accent')}
          value={draft.accent}
          onChange={(accent) => edit({ accent })}
        />
      </AccountPreferenceRow>
      <AccountPreferenceRow label={t('background')} description={t('backgroundDescription')}>
        <AccountCustomThemeColor
          label={t('background')}
          value={draft.background}
          onChange={(background) => edit({ background })}
        />
      </AccountPreferenceRow>
      <AccountPreferenceRow label={t('contrast')} description={t('contrastDescription')}>
        <div className="flex w-full items-center gap-3 sm:w-44">
          <input
            type="range"
            min={0}
            max={100}
            value={draft.contrast}
            onChange={(e) => edit({ contrast: Number(e.target.value) })}
            aria-label={t('contrast')}
            className="min-w-0 flex-1 accent-primary"
          />
          <span className="w-7 text-end text-xs text-muted-foreground tabular-nums">
            {draft.contrast}
          </span>
        </div>
      </AccountPreferenceRow>
      <AccountPreferenceRow label={t('sharePalette')} description={t('sharePaletteDescription')}>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={copy}>
            <Copy />
            {t('copyPalette')}
          </Button>
          <Button variant="ghost" size="sm" onClick={paste}>
            <ClipboardPaste />
            {t('pastePalette')}
          </Button>
        </div>
      </AccountPreferenceRow>
    </>
  );
}
