import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import { qk } from '@/services/queryKeys';
import account from '../../../../../messages/en/account.json';
import auth from '../../../../../messages/en/auth.json';
import common from '../../../../../messages/en/common.json';

const globals = [
  'window',
  'document',
  'navigator',
  'Node',
  'NodeFilter',
  'DocumentFragment',
  'Element',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLButtonElement',
  'HTMLFormElement',
  'SVGElement',
  'ShadowRoot',
  'Event',
  'CustomEvent',
  'MutationObserver',
  'getComputedStyle',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

type Spy = {
  mockImplementation: (implementation: () => unknown) => Spy;
  mockRestore: () => void;
};
const { spyOn } = createRequire(import.meta.url)('bun:test') as {
  spyOn: (target: object, method: string) => Spy;
};

type AuthResult = {
  data: { user: { id: string } } | null;
  error: null | {
    code: string;
    message: string;
    status: number;
    statusText: string;
  };
};

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let originals: Map<string, PropertyDescriptor | undefined>;
let spies: Spy[];
let added: number;
let confirmed: number;
let addCalls: number;
let passwordInputs: unknown[];
let magicLinkInputs: unknown[];
let redirects: string[];
let addResult: { data: object | null; error: AuthResult['error'] };
let passwordResult: AuthResult;
let passkeyResult: AuthResult;

const userId = 'member-1';
const email = 'ada@example.test';
const labels = account.security;
const succeeded = (): AuthResult => ({ data: { user: { id: userId } }, error: null });

function providers(
  config: { emailPassword?: boolean; google?: boolean; oidc?: boolean; magicLink?: boolean },
  accounts = [{ providerId: 'credential' }],
) {
  client.setQueryData(qk.authConfig, { emailPassword: true, magicLink: false, ...config });
  client.setQueryData(qk.linkedAccounts, accounts);
  client.setQueryData(qk.passkeys, []);
}

async function render(children: ReactNode) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={{ account, auth, common }} timeZone="UTC">
          {children}
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
}

async function renderAdd() {
  const { default: AddPasskey } = await import('./AccountSecurityAddPasskey');
  await render(<AddPasskey onAdded={() => added++} />);
}

async function renderConfirmation() {
  const { default: ConfirmSession } = await import('./AccountSecurityConfirmSession');
  await render(
    <ConfirmSession
      userId={userId}
      email={email}
      onClose={() => {}}
      onConfirmed={() => confirmed++}
    />,
  );
}

async function click(text: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (item) => item.textContent?.trim() === text,
  );
  assert.ok(button, `Missing button: ${text}`);
  await act(async () => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

async function submitPassword(value: string) {
  const field = document.querySelector<HTMLInputElement>('input[type="password"]');
  assert.ok(field);
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(
      field,
      value,
    );
    field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await act(async () => {
    document.querySelector<HTMLFormElement>('form')!.requestSubmit();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

beforeEach(async () => {
  originals = new Map(
    globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://example.test/account/security',
    pretendToBeVisual: true,
  });
  for (const name of globals) {
    if (name in dom.window)
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: dom.window[name as keyof typeof dom.window],
      });
  }
  Object.defineProperties(globalThis, {
    getComputedStyle: { configurable: true, value: dom.window.getComputedStyle.bind(dom.window) },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  dom.window.__ITSAPLAN_ENV__ = { apiUrl: 'https://example.test', privacyUrl: '', termsUrl: '' };
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  providers({});
  spies = [];
  added = 0;
  confirmed = 0;
  addCalls = 0;
  passwordInputs = [];
  magicLinkInputs = [];
  redirects = [];
  addResult = { data: { id: 'new-key' }, error: null };
  passwordResult = succeeded();
  passkeyResult = succeeded();
  const sdk = await import('@/lib/auth-client');
  spies.push(
    spyOn(sdk, 'useSession').mockImplementation(() => ({
      data: { user: { id: userId, email } },
      isPending: false,
      error: null,
    })),
  );
  // Spy on exported method groups so the SDK's dynamic nested proxies cannot retain a real fetch.
  const passkey = spyOn(sdk, 'passkey');
  Object.assign(passkey, {
    addPasskey: async () => {
      addCalls++;
      return addResult;
    },
  });
  spies.push(passkey);
  const signIn = spyOn(sdk, 'signIn');
  Object.assign(signIn, {
    email: async (input: unknown) => {
      passwordInputs.push(input);
      return passwordResult;
    },
    passkey: async () => passkeyResult,
    social: async () => {
      throw new Error('Unexpected provider request');
    },
    magicLink: async (input: unknown) => {
      magicLinkInputs.push(input);
      return { data: { status: true }, error: null };
    },
  });
  spies.push(signIn);
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.querySelector('#root')!);
});

afterEach(async () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  await act(async () => root.unmount());
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));
  for (const spy of spies.reverse()) spy.mockRestore();
  client.clear();
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('AccountSecurityAddPasskey', () => {
  it('opens confirmation for the structured stale-session code without reporting enrollment', async () => {
    addResult = {
      data: null,
      error: {
        code: 'SESSION_NOT_FRESH',
        message: 'Session is not fresh',
        status: 403,
        statusText: 'FORBIDDEN',
      },
    };
    await renderAdd();
    await click(labels.addPasskey);

    assert.ok(document.querySelector('[role="dialog"]'));
    assert.ok(document.body.textContent?.includes(labels.confirmSessionTitle));
    assert.equal(added, 0);
    assert.equal(addCalls, 1);
  });

  it('keeps an unrelated 403 as an error without offering confirmation', async () => {
    addResult = {
      data: null,
      error: {
        code: 'ACCOUNT_DEACTIVATED',
        message: 'Refused',
        status: 403,
        statusText: 'FORBIDDEN',
      },
    };
    await renderAdd();
    await click(labels.addPasskey);

    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.ok(document.querySelector('[role="alert"]'));
    assert.equal(added, 0);
  });

  it('reports a successful enrollment to the parent', async () => {
    await renderAdd();
    await click(labels.addPasskey);

    assert.equal(added, 1);
    assert.equal(addCalls, 1);
    assert.equal(document.querySelector('[role="dialog"]'), null);
  });

  it('requires a new Add click after confirming the same account', async () => {
    addResult = {
      data: null,
      error: { code: 'SESSION_NOT_FRESH', message: 'Stale', status: 403, statusText: 'FORBIDDEN' },
    };
    await renderAdd();
    await click(labels.addPasskey);
    await submitPassword('correct-password');

    assert.deepEqual(passwordInputs, [{ email, password: 'correct-password' }]);
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.ok(document.body.textContent?.includes(labels.sessionConfirmed));
    assert.equal(added, 0);
    assert.equal(addCalls, 1);
    addResult = { data: { id: 'new-key' }, error: null };
    await click(labels.addPasskey);
    assert.equal(added, 1);
    assert.equal(addCalls, 2);
  });
});

describe('AccountSecurityConfirmSession', () => {
  it('does not offer a password while instance password sign-in is disabled', async () => {
    providers({ emailPassword: false, google: true, magicLink: true }, [
      { providerId: 'credential' },
      { providerId: 'google' },
    ]);
    await renderConfirmation();

    assert.equal(document.querySelector('input[type="password"]'), null);
    assert.ok(
      !document.body.textContent?.includes(labels.confirmWithLink),
      'Email links are unavailable when password sign-in is disabled',
    );
    assert.ok(document.body.textContent?.includes('Continue with Google'));
  });

  it('sends a sign-in link for the current email only when both email policies allow it', async () => {
    providers({ emailPassword: true, magicLink: true });
    await renderConfirmation();
    await click(labels.confirmWithLink);

    assert.deepEqual(magicLinkInputs, [
      {
        email,
        callbackURL: 'https://example.test/account/security',
        errorCallbackURL: 'https://example.test/login',
      },
    ]);
    assert.ok(
      document.body.textContent?.includes(labels.confirmLinkSent.replace('{email}', email)),
    );
    assert.ok(document.querySelector('[role="dialog"]'));
    assert.equal(confirmed, 0);
    assert.equal(addCalls, 0);
  });

  it('does not offer a password to an account with only a provider credential', async () => {
    providers({ google: true }, [{ providerId: 'google' }]);
    await renderConfirmation();

    assert.equal(document.querySelector('input[type="password"]'), null);
    assert.ok(document.body.textContent?.includes('Continue with Google'));
  });

  it('keeps a wrong-password error in the dialog without confirming or enrolling', async () => {
    passwordResult = {
      data: null,
      error: {
        code: 'INVALID_EMAIL_OR_PASSWORD',
        message: 'Invalid email or password',
        status: 401,
        statusText: 'UNAUTHORIZED',
      },
    };
    await renderConfirmation();
    await submitPassword('wrong-password');

    assert.deepEqual(passwordInputs, [{ email, password: 'wrong-password' }]);
    assert.ok(document.querySelector('[role="dialog"]'));
    assert.ok(document.body.textContent?.includes(auth.errors.invalidCredentials));
    assert.equal(confirmed, 0);
    assert.equal(addCalls, 0);
  });

  it('reloads after a different passkey account without confirming the original account', async () => {
    const { useConfirmSession } = await import('../../hooks/useConfirmSession');
    function Probe() {
      const confirm = useConfirmSession(userId, email, () => confirmed++);
      return <button onClick={() => void confirm.passkey()}>Confirm passkey</button>;
    }
    passkeyResult = { data: { user: { id: 'another-member' } }, error: null };
    await render(<Probe />);
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: new Proxy(dom.window, {
        get(target, key) {
          if (key === 'location')
            return { origin: 'https://example.test', assign: (url: string) => redirects.push(url) };
          const value = Reflect.get(target, key, target);
          return typeof value === 'function' &&
            (key === 'addEventListener' || key === 'removeEventListener')
            ? value.bind(target)
            : value;
        },
      }),
    });
    await click('Confirm passkey');

    assert.deepEqual(redirects, ['https://example.test/account/security']);
    assert.equal(confirmed, 0);
    assert.equal(addCalls, 0);
  });
});
