import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import settings from '../../../../../messages/en/settings.json';

// A GitHub App connection is made from the App's id, an installation id and the App's
// private key. The key is chosen from its .pem file, or pasted. The dialog sends them to
// the team's github-app route and closes when the connection exists.

const git = settings.git;
const KEY_BODY = 'MIIEowIBAAKCAQEAsecretkeybody';
const PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----\n${KEY_BODY}\n-----END RSA PRIVATE KEY-----\n`;
const MAX_KEY_BYTES = 8192;

let dom: JSDOM;
let root: Root;
let queryClient: QueryClient;
let originals: Map<string, PropertyDescriptor | undefined>;
let originalFetch: typeof fetch;
let calls: { method: string; path: string; body: unknown }[];
let openChanges: boolean[];

const wait = (ms = 20) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

async function render(open = true) {
  const { default: TeamGitHubAppConnectDialog } = await import('./TeamGitHubAppConnectDialog');
  await act(async () =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ settings }} timeZone="UTC">
        <QueryClientProvider client={queryClient}>
          <TeamGitHubAppConnectDialog
            teamId={7}
            open={open}
            onOpenChange={(next) => openChanges.push(next)}
          />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    ),
  );
  await wait();
}

function field(label: string) {
  const element = [...document.querySelectorAll('label')].find(
    (candidate) => candidate.textContent === label,
  );
  assert.ok(element, `Missing label: ${label}`);
  return document.getElementById(element.htmlFor) as
    HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement;
}

async function type(label: string, value: string) {
  const target = field(label);
  const prototype =
    target.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement : dom.window.HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype.prototype, 'value')!.set!.call(target, value);
    target.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}

const loaded = (name = 'key.pem') => git.nativePrivateKeyLoaded.replace('{name}', name);
const pem = (content = PRIVATE_KEY, name = 'key.pem') => new File([content], name);

function slowPem(name = 'key.pem') {
  let resolveText!: (text: string) => void;
  const file = pem('', name);
  Object.defineProperty(file, 'text', {
    value: () => new Promise<string>((resolve) => (resolveText = resolve)),
  });
  return {
    file,
    finish: (text: string) =>
      act(async () => {
        resolveText(text);
        await new Promise<void>((resolve) => setTimeout(resolve, 20));
      }),
  };
}

async function pickFile(file: File) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  assert.ok(input, 'Missing file input');
  await act(async () => {
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  });
}

async function click(label: string) {
  const button = [...document.querySelectorAll('button')].find(
    (element) => element.textContent === label,
  );
  assert.ok(button, `Missing button: ${label}`);
  await act(async () => button.click());
}

const submitButton = () =>
  [...document.querySelectorAll('button')].find(
    (element) => element.type === 'submit',
  ) as HTMLButtonElement;

async function submit() {
  await act(async () => {
    submitButton().click();
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  });
}

beforeEach(async () => {
  dom = new JSDOM('<div id="root"></div>', {
    url: 'https://planner.test/teams/7/settings',
    pretendToBeVisual: true,
  });
  dom.window.__ITSAPLAN_ENV__ = { apiUrl: 'http://api.test', privacyUrl: '', termsUrl: '' };
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    HTMLFormElement: dom.window.HTMLFormElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    CustomEvent: dom.window.CustomEvent,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  originals = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  originalFetch = globalThis.fetch;
  calls = [];
  openChanges = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({
      method: init?.method ?? 'GET',
      path: new URL(String(input)).pathname,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    return Response.json({ id: 1 }, { status: 201 });
  }) as typeof fetch;
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
});

afterEach(async () => {
  await act(() => root.unmount());
  await wait(5);
  queryClient.clear();
  globalThis.fetch = originalFetch;
  dom.window.close();
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

describe('TeamGitHubAppConnectDialog', () => {
  it('asks for the provider URL, App ID, installation ID and a private key file', async () => {
    await render();

    assert.ok(document.body.textContent?.includes(git.nativeGithubAppHint));
    assert.equal(field(git.nativeBaseUrl).value, 'https://github.com');
    assert.ok(field(git.nativeAppId));
    assert.ok(field(git.nativeInstallationId));
    assert.equal(field(git.nativePrivateKey).tagName, 'BUTTON');
    assert.equal(field(git.nativePrivateKey).textContent, git.nativePrivateKeyChooseFile);
    assert.equal(document.querySelector('input[type="file"]')?.getAttribute('accept'), '.pem');
    assert.equal(document.querySelector('textarea'), null);
    assert.ok(document.body.textContent?.includes(git.nativePrivateKeyFileHint));
  });

  it('keeps Connect disabled until the App ID, installation ID and key are filled in', async () => {
    await render();
    assert.equal(submitButton().disabled, true);

    await type(git.nativeAppId, '123456');
    await type(git.nativeInstallationId, '   ');
    await pickFile(pem());
    assert.equal(submitButton().disabled, true);

    await type(git.nativeInstallationId, '98765');
    assert.equal(submitButton().disabled, false);

    await type(git.nativeAppId, '  ');
    assert.equal(submitButton().disabled, true);
    await type(git.nativeAppId, '123456');

    await pickFile(pem('  '));
    assert.equal(submitButton().disabled, true);
  });

  it("connects through the team's github-app route with the chosen file's content", async () => {
    await render();
    await type(git.nativeAppId, ' 123456 ');
    await type(git.nativeInstallationId, ' 98765 ');
    await pickFile(pem());

    await submit();

    assert.deepEqual(calls, [
      {
        method: 'POST',
        path: '/teams/7/settings/git/connections/github-app',
        body: {
          baseUrl: 'https://github.com',
          appId: '123456',
          installationId: '98765',
          privateKey: PRIVATE_KEY,
        },
      },
    ]);
    assert.deepEqual(openChanges, [false]);
  });

  it('shows the name of the chosen file and never its content', async () => {
    await render();
    await pickFile(pem(PRIVATE_KEY, 'my-app.private-key.pem'));

    assert.ok(
      document.body.textContent?.includes(
        git.nativePrivateKeyLoaded.replace('{name}', 'my-app.private-key.pem'),
      ),
    );
    assert.equal(document.querySelector('textarea'), null);
    assert.ok(!document.body.textContent?.includes(KEY_BODY));
    assert.ok(!document.body.innerHTML.includes(KEY_BODY));
  });

  it('refuses a file too large to be a key without keeping the key of an earlier file', async () => {
    await render();
    await type(git.nativeAppId, '123456');
    await type(git.nativeInstallationId, '98765');
    await pickFile(pem());
    assert.equal(submitButton().disabled, false);
    const big = pem('a'.repeat(MAX_KEY_BYTES + 1), 'big.pem');
    let reads = 0;
    Object.defineProperty(big, 'text', {
      value: () => {
        reads += 1;
        return Promise.resolve('');
      },
    });

    await pickFile(big);

    assert.equal(reads, 0);
    assert.equal(
      document.querySelector('[role="alert"]')?.textContent,
      git.nativePrivateKeyTooLarge,
    );
    assert.ok(!document.body.textContent?.includes(loaded()));
    assert.equal(submitButton().disabled, true);
  });

  it('accepts a file of exactly the largest size and clears an earlier error', async () => {
    await render();
    await type(git.nativeAppId, '123456');
    await type(git.nativeInstallationId, '98765');
    await pickFile(pem('a'.repeat(MAX_KEY_BYTES + 1), 'big.pem'));
    assert.ok(document.querySelector('[role="alert"]'));

    await pickFile(pem('a'.repeat(MAX_KEY_BYTES)));

    assert.equal(document.querySelector('[role="alert"]'), null);
    assert.equal(submitButton().disabled, false);
  });

  it('says so when the file cannot be read', async () => {
    await render();
    const unreadable = pem();
    Object.defineProperty(unreadable, 'text', {
      value: () => Promise.reject(new Error('denied')),
    });

    await pickFile(unreadable);

    assert.equal(
      document.querySelector('[role="alert"]')?.textContent,
      git.nativePrivateKeyUnreadable,
    );
    assert.equal(submitButton().disabled, true);
  });

  it('offers a text area to paste the key and sends what was pasted', async () => {
    await render();
    await type(git.nativeAppId, '123456');
    await type(git.nativeInstallationId, '98765');

    await click(git.nativePrivateKeyPasteInstead);

    assert.equal(document.querySelector('input[type="file"]'), null);
    assert.equal(field(git.nativePrivateKey).tagName, 'TEXTAREA');
    assert.equal(field(git.nativePrivateKey).getAttribute('dir'), 'ltr');
    assert.ok(document.body.textContent?.includes(git.nativePrivateKeyPasteHint));
    assert.equal(submitButton().disabled, true);

    await type(git.nativePrivateKey, PRIVATE_KEY);
    assert.equal(submitButton().disabled, false);
    await type(git.nativePrivateKey, '  ');
    assert.equal(submitButton().disabled, true);
    await type(git.nativePrivateKey, PRIVATE_KEY);
    await submit();

    assert.equal((calls[0].body as { privateKey: string }).privateKey, PRIVATE_KEY);
  });

  it('clears the key when it switches between choosing a file and pasting', async () => {
    await render();
    await type(git.nativeAppId, '123456');
    await type(git.nativeInstallationId, '98765');
    await pickFile(pem());
    assert.equal(submitButton().disabled, false);

    await click(git.nativePrivateKeyPasteInstead);
    assert.equal((field(git.nativePrivateKey) as HTMLTextAreaElement).value, '');
    assert.equal(submitButton().disabled, true);

    await type(git.nativePrivateKey, PRIVATE_KEY);
    assert.equal(submitButton().disabled, false);

    await click(git.nativePrivateKeyFileInstead);
    assert.equal(field(git.nativePrivateKey).tagName, 'BUTTON');
    assert.ok(!document.body.textContent?.includes(loaded()));
    assert.equal(submitButton().disabled, true);
  });

  it('drops a file that finishes reading after switching to paste', async () => {
    await render();
    const slow = slowPem();
    await pickFile(slow.file);
    await click(git.nativePrivateKeyPasteInstead);

    await slow.finish(PRIVATE_KEY);

    assert.equal((field(git.nativePrivateKey) as HTMLTextAreaElement).value, '');
  });

  it('keeps the later file when an earlier one finishes reading last', async () => {
    await render();
    await type(git.nativeAppId, '123456');
    await type(git.nativeInstallationId, '98765');
    const slow = slowPem('slow.pem');
    await pickFile(slow.file);
    await pickFile(pem(PRIVATE_KEY, 'later.pem'));

    await slow.finish('stale key');

    assert.ok(document.body.textContent?.includes(loaded('later.pem')));
    await submit();
    assert.equal((calls[0].body as { privateKey: string }).privateKey, PRIVATE_KEY);
  });

  it('starts again from the file chooser, without a key, when it is opened again', async () => {
    await render();
    await type(git.nativeAppId, '123456');
    await type(git.nativeInstallationId, '98765');
    await pickFile(pem());
    await click(git.nativePrivateKeyPasteInstead);
    await type(git.nativePrivateKey, PRIVATE_KEY);

    await render(false);
    await render(true);

    assert.equal(field(git.nativePrivateKey).tagName, 'BUTTON');
    assert.ok(!document.body.textContent?.includes(loaded()));
    assert.equal(submitButton().disabled, true);
  });
});
