'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { MCP_CLIENTS, MCP_URL } from '../utils/clients';
import McpCodeBlock from './McpCodeBlock';

// The literal the reader swaps for their own key. Passed as a value rather than
// written into the messages: angle brackets in a message are parsed as rich-text tags.
const API_KEY_PLACEHOLDER = '<API_KEY>';

export default function McpConnectionGuide() {
  const t = useTranslations('mcp');
  const [activeLabel, setActiveLabel] = useState(MCP_CLIENTS[0].label);
  const client = MCP_CLIENTS.find((c) => c.label === activeLabel) ?? MCP_CLIENTS[0];
  const clientLabel = (c: (typeof MCP_CLIENTS)[number]) =>
    c.labelKey ? t(`clients.${c.labelKey}`) : c.label;

  return (
    <section className="space-y-5">
      <div className="border-b pb-1">
        <span className="text-xs font-medium text-muted-foreground">{t('connectClient')}</span>
      </div>

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

      <div className="space-y-3">
        <div role="tablist" aria-label={t('clientTabsAria')} className="flex flex-wrap gap-1">
          {MCP_CLIENTS.map((c) => {
            const selected = c.label === activeLabel;
            return (
              <button
                key={c.label}
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveLabel(c.label)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  selected
                    ? 'bg-secondary font-medium text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {clientLabel(c)}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {(client.file || client.noteKey) && (
            <p className="text-sm text-muted-foreground">
              {client.file && (
                <>
                  {t.rich('addToFile', {
                    file: client.file,
                    code: (chunks) => <code className="font-mono text-xs">{chunks}</code>,
                  })}
                  {client.noteKey ? '. ' : ''}
                </>
              )}
              {client.noteKey && t(`notes.${client.noteKey}`, { apiKey: API_KEY_PLACEHOLDER })}
            </p>
          )}
          <McpCodeBlock code={client.code} />
        </div>
      </div>
    </section>
  );
}
