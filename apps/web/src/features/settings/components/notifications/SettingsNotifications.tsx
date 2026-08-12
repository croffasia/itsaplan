import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import EmailSettings from './EmailSettings';
import TelegramSettings from './TelegramSettings';
import type { EmailForm } from '../../hooks/useEmailForm';
import type { TelegramForm } from '../../hooks/useTelegramForm';
import { useTranslations } from 'next-intl';

export type NotificationTab = 'email' | 'telegram';

// The email (SMTP or Resend) and Telegram bot credentials the project delivers
// through, one tab per channel.
export default function SettingsNotifications({
  tab,
  onTabChange,
  emailForm,
  telegramForm,
}: {
  tab: NotificationTab;
  onTabChange: (v: NotificationTab) => void;
  emailForm: EmailForm;
  telegramForm: TelegramForm;
}) {
  const t = useTranslations('settings.notifications');
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => onTabChange(v as NotificationTab)}
      className="flex flex-col gap-8"
    >
      <TabsList variant="line">
        <TabsTrigger value="email">{t('email')}</TabsTrigger>
        <TabsTrigger value="telegram">{t('telegram')}</TabsTrigger>
      </TabsList>

      <TabsContent value="email" className="mt-0">
        <EmailSettings form={emailForm} />
      </TabsContent>

      <TabsContent value="telegram" className="mt-0">
        <TelegramSettings form={telegramForm} />
      </TabsContent>
    </Tabs>
  );
}
