'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import SettingsCard from '@/components/common/page/SettingsCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MCP_CLIENTS, MCP_URL } from '../utils/clients';
import McpCodeBlock from './McpCodeBlock';

// The literal the reader swaps for their own key. Passed as a value rather than
// written into the messages: angle brackets in a message are parsed as rich-text tags.
const API_KEY_PLACEHOLDER = '<API_KEY>';

export default function McpConnectionGuide() {
  const t = useTranslations('mcp');
  const clientLabel = (c: (typeof MCP_CLIENTS)[number]) =>
    c.labelKey ? t(`clients.${c.labelKey}`) : c.label;

  return (
    <SettingsCard className="space-y-5 p-5">
      <p className="text-sm text-muted-foreground">
        {t.rich('keyHint', {
          apiKey: API_KEY_PLACEHOLDER,
          link: (chunks) => (
            <Link
              href="/account/api-keys"
              className="font-medium text-foreground underline underline-offset-4"
            >
              {chunks}
            </Link>
          ),
          code: (chunks) => <code className="font-mono text-xs">{chunks}</code>,
        })}
      </p>

      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">{t('endpoint')}</span>
        <McpCodeBlock code={MCP_URL} />
      </div>

      <Tabs defaultValue={MCP_CLIENTS[0].label} className="gap-3">
        <TabsList aria-label={t('clientTabsAria')}>
          {MCP_CLIENTS.map((c) => (
            <TabsTrigger key={c.label} value={c.label}>
              {clientLabel(c)}
            </TabsTrigger>
          ))}
        </TabsList>
        {MCP_CLIENTS.map((c) => (
          <TabsContent key={c.label} value={c.label} className="space-y-2">
            {(c.file || c.noteKey) && (
              <p className="text-sm text-muted-foreground">
                {c.file && (
                  <>
                    {t.rich('addToFile', {
                      file: c.file,
                      code: (chunks) => <code className="font-mono text-xs">{chunks}</code>,
                    })}
                    {c.noteKey ? '. ' : ''}
                  </>
                )}
                {c.noteKey && t(`notes.${c.noteKey}`, { apiKey: API_KEY_PLACEHOLDER })}
              </p>
            )}
            <McpCodeBlock code={c.code} />
          </TabsContent>
        ))}
      </Tabs>
    </SettingsCard>
  );
}
