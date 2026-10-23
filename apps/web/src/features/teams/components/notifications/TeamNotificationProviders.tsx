'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { NotificationSettings } from '@/lib/api/endpoints/notificationSettings';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEmailForm } from '../../hooks/useEmailForm';
import { useTelegramForm } from '../../hooks/useTelegramForm';
import { useAppriseForm } from '../../hooks/useAppriseForm';
import EmailSettings from './EmailSettings';
import TelegramSettings from './TelegramSettings';
import AppriseSettings from './AppriseSettings';

type NotificationTab = 'email' | 'telegram' | 'apprise';

// One tab per channel, each saving on its own: Save acts on the active tab and is
// enabled once that tab has an unsaved change.
export default function TeamNotificationProviders({
  teamId,
  settings,
}: {
  teamId: number;
  settings: NotificationSettings;
}) {
  const t = useTranslations('teams.notifications');
  const tCommon = useTranslations('common');
  const [tab, setTab] = useState<NotificationTab>('email');
  const emailForm = useEmailForm(teamId, settings);
  const telegramForm = useTelegramForm(teamId, settings);
  const appriseForm = useAppriseForm(teamId, settings);
  const active = tab === 'email' ? emailForm : tab === 'telegram' ? telegramForm : appriseForm;

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as NotificationTab)}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center justify-between gap-2">
        <TabsList variant="line" className="w-auto">
          <TabsTrigger value="email">{t('email')}</TabsTrigger>
          <TabsTrigger value="telegram">{t('telegram')}</TabsTrigger>
          <TabsTrigger value="apprise">{t('apprise')}</TabsTrigger>
        </TabsList>
        <Button
          size="sm"
          onClick={() => void active.save()}
          disabled={!active.dirty || active.saving}
        >
          {tCommon('save')}
        </Button>
      </div>

      <TabsContent value="email" className="mt-0">
        <EmailSettings form={emailForm} />
      </TabsContent>

      <TabsContent value="telegram" className="mt-0">
        <TelegramSettings form={telegramForm} />
      </TabsContent>

      <TabsContent value="apprise" className="mt-0">
        <AppriseSettings form={appriseForm} />
      </TabsContent>
    </Tabs>
  );
}
