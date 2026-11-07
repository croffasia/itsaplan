'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import type { Locale } from '@/i18n/locales';
import GodSettingsGate from './components/GodSettingsGate';
import GodEmailTemplatesForm from './components/email-templates/GodEmailTemplatesForm';
import type { EmailSelection } from './hooks/useGodEmailTemplatesForm';
import { useEmailTemplatesQuery } from './services/god.service';

// The selection is held above the gate: a save remounts the form, and the email and the tab
// on the screen stay.
export default function GodEmailTemplatesPage() {
  const query = useEmailTemplatesQuery();
  const locale = useLocale() as Locale;
  const [selection, setSelection] = useState<EmailSelection>({
    key: 'reset',
    locale,
    tab: 'emails',
  });

  return (
    <GodSettingsGate slug="email-templates" data={query.data}>
      {(settings) => (
        <GodEmailTemplatesForm
          settings={settings}
          selection={selection}
          onSelect={(patch) => setSelection((current) => ({ ...current, ...patch }))}
        />
      )}
    </GodSettingsGate>
  );
}
