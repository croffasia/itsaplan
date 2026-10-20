import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';
import type { InstanceEmailSettings, InstanceEmailSettingsPatch } from '@/lib/api/endpoints/god';
import type { GodEmailForm } from './useGodEmailForm';

// A Microsoft 365 mailbox with MFA is reached with an app registration, not a password:
// choosing that mode points an empty server at Microsoft, asks for the app's ids and
// secret instead of the password, and sends them with the provider.
let saved: InstanceEmailSettingsPatch[] = [];

const settings: InstanceEmailSettings = {
  smtp: {
    enabled: false,
    host: '',
    port: null,
    encryption: 'none',
    username: '',
    hasPassword: false,
    timeout: null,
    auth: 'password',
    oauth: { tenantId: '', clientId: '', hasClientSecret: false },
  },
  resend: { enabled: false, hasApiKey: false },
  from: '',
  allowProjects: false,
};

let dom: JSDOM;
let root: Root;
let form: GodEmailForm;
let client: QueryClient;
const replaced = ['window', 'document', 'fetch', 'IS_REACT_ACT_ENVIRONMENT'] as const;
let originals: Map<string, PropertyDescriptor | undefined>;

beforeEach(async () => {
  originals = new Map(replaced.map((n) => [n, Object.getOwnPropertyDescriptor(globalThis, n)]));
  dom = new JSDOM('<!doctype html><div id="root"></div>');
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    // The settings endpoint: a save is recorded and answered with the stored settings.
    fetch: {
      configurable: true,
      value: async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PUT') saved.push(JSON.parse(String(init.body)));
        return Response.json(settings);
      },
    },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  Object.defineProperty(window, '__ITSAPLAN_ENV__', {
    value: { apiUrl: 'https://api.test', privacyUrl: '', termsUrl: '' },
  });
  saved = [];
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(dom.window.document.querySelector('#root')!);
  const { useGodEmailForm } = await import('./useGodEmailForm');
  function Probe() {
    form = useGodEmailForm(settings);
    return null;
  }
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    ),
  );
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

const step = (fn: () => void) => act(async () => fn());

describe('useGodEmailForm with Microsoft 365', () => {
  it('points an empty server at Microsoft 365 when the mode is chosen', async () => {
    await step(() => form.setSmtpAuth('microsoft365'));

    assert.equal(form.host, 'smtp.office365.com');
    assert.equal(form.port, '587');
    assert.equal(form.encryption, 'tls');
  });

  it('asks for the mailbox and the app credentials instead of a password', async () => {
    await step(() => {
      form.setEnabled(true);
      form.setSmtpAuth('microsoft365');
    });
    assert.equal(form.testable, false);

    await step(() => {
      form.setUsername('mailer@example.com');
      form.setTenantId('tenant-1');
      form.setClientId('client-1');
      form.setClientSecret('app-secret');
    });
    assert.equal(form.testable, true);
  });

  it('sends the app credentials with the provider', async () => {
    await step(() => {
      form.setEnabled(true);
      form.setSmtpAuth('microsoft365');
      form.setUsername('mailer@example.com');
      form.setTenantId('tenant-1');
      form.setClientId('client-1');
      form.setClientSecret('app-secret');
    });

    await act(async () => form.save());

    assert.deepEqual(saved[0]!.smtp, {
      enabled: true,
      host: 'smtp.office365.com',
      port: 587,
      encryption: 'tls',
      username: 'mailer@example.com',
      timeout: null,
      auth: 'microsoft365',
      oauth: { tenantId: 'tenant-1', clientId: 'client-1', clientSecret: 'app-secret' },
    });
  });
});
