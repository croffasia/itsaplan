'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { MCP_CLIENTS, MCP_URL } from '../utils/clients';
import McpCodeBlock from './McpCodeBlock';

export default function McpConnectionGuide() {
  const [activeLabel, setActiveLabel] = useState(MCP_CLIENTS[0].label);
  const client = MCP_CLIENTS.find((c) => c.label === activeLabel) ?? MCP_CLIENTS[0];

  return (
    <section className="space-y-5">
      <div className="border-b pb-1">
        <span className="text-xs font-medium text-muted-foreground">Connect a client</span>
      </div>

      <p className="text-sm text-muted-foreground">
        The server speaks MCP over Streamable HTTP. Authenticate with a personal API key as a Bearer
        token. Create one on the{' '}
        <Link
          href="/account/api-keys"
          className="font-medium text-foreground underline underline-offset-4"
        >
          API keys
        </Link>{' '}
        page, then replace <code className="font-mono text-xs">&lt;API_KEY&gt;</code> in the
        snippet.
      </p>

      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">Endpoint</span>
        <McpCodeBlock code={MCP_URL} />
      </div>

      <div className="space-y-3">
        <div role="tablist" aria-label="Client" className="flex flex-wrap gap-1">
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
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {(client.file || client.note) && (
            <p className="text-sm text-muted-foreground">
              {client.file && (
                <>
                  Add to <code className="font-mono text-xs">{client.file}</code>
                  {client.note ? '. ' : ''}
                </>
              )}
              {client.note}
            </p>
          )}
          <McpCodeBlock code={client.code} />
        </div>
      </div>
    </section>
  );
}
