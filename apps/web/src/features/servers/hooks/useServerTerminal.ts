'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import { serverTerminalUrl } from '@/lib/api';

export type TerminalStatus = 'connecting' | 'connected' | 'closed' | 'error';

interface ServerMessage {
  type: 'ready' | 'data' | 'error' | 'closed' | 'pinned';
  data?: string;
  message?: string;
  fingerprint?: string;
}

export interface TerminalSnapshot {
  status: TerminalStatus;
  error: string | null;
  pinned: string | null;
}

// The API refuses a frame over 8 KB, so a longer paste is split. Half of that
// bound leaves room for the base64 growth of the frame around it.
const MAX_CHUNK_BYTES = 4 * 1024;

const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

// A long paste is sent as several frames. A split is never made in the middle of a
// character: a continuation byte (10xxxxxx) would arrive as a separate frame and
// the server would decode both halves as replacement characters.
function chunkUtf8(bytes: Uint8Array): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + MAX_CHUNK_BYTES, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    chunks.push(bytes.subarray(start, end));
    start = end;
  }
  return chunks;
}

// A running shell, kept outside React. Leaving the console page detaches the
// terminal from the DOM but keeps the socket open and the buffer filled, so
// walking to another section and back returns to the same session rather than a
// fresh login. The element the terminal was opened on is kept too: xterm can only
// be opened once, so it is moved between containers instead of reopened.
interface LiveTerminal {
  host: HTMLDivElement;
  term: Terminal;
  fit: FitAddon;
  socket: WebSocket;
  observer: ResizeObserver;
  snapshot: TerminalSnapshot;
  listeners: Set<(snapshot: TerminalSnapshot) => void>;
}

const live = new Map<number, LiveTerminal>();
const opening = new Map<number, Promise<LiveTerminal>>();

function publish(session: LiveTerminal, patch: Partial<TerminalSnapshot>): void {
  session.snapshot = { ...session.snapshot, ...patch };
  for (const listener of session.listeners) listener(session.snapshot);
}

function isUsable(session: LiveTerminal): boolean {
  return (
    session.socket.readyState === WebSocket.OPEN ||
    session.socket.readyState === WebSocket.CONNECTING
  );
}

function sendText(session: LiveTerminal, text: string): void {
  if (session.socket.readyState !== WebSocket.OPEN || text.length === 0) return;
  for (const chunk of chunkUtf8(encoder.encode(text))) {
    session.socket.send(JSON.stringify({ type: 'input', data: bytesToBase64(chunk) }));
  }
}

function resize(session: LiveTerminal): void {
  if (!session.host.isConnected) return;
  session.fit.fit();
  if (session.socket.readyState !== WebSocket.OPEN) return;
  session.socket.send(
    JSON.stringify({ type: 'resize', cols: session.term.cols, rows: session.term.rows }),
  );
}

function dispose(serverId: number): void {
  const session = live.get(serverId);
  if (!session) return;
  live.delete(serverId);
  session.listeners.clear();
  session.observer.disconnect();
  session.socket.close();
  session.term.dispose();
  session.host.remove();
}

// Reading the clipboard needs a user gesture and a secure context (https or
// localhost). Where the browser refuses, the terminal's own paste still works,
// which is what the message points at.
async function pasteInto(session: LiveTerminal): Promise<void> {
  try {
    const text = await navigator.clipboard.readText();
    if (text) sendText(session, text);
  } catch {
    publish(session, {
      error: 'The browser would not hand over the clipboard. Use Ctrl+Shift+V instead.',
    });
  }
}

async function copyFrom(session: LiveTerminal): Promise<boolean> {
  const selected = session.term.getSelection();
  if (!selected) return false;
  try {
    await navigator.clipboard.writeText(selected);
    session.term.clearSelection();
    return true;
  } catch {
    return false;
  }
}

async function createSession(serverId: number, container: HTMLElement): Promise<LiveTerminal> {
  const [{ Terminal: XTerm }, { FitAddon: Fit }] = await Promise.all([
    import('@xterm/xterm'),
    import('@xterm/addon-fit'),
  ]);

  // Reads the page's own tokens, so the terminal follows the dashboard theme
  // instead of shipping a second palette.
  const style = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;

  const host = document.createElement('div');
  host.className = 'h-full w-full';
  container.append(host);

  const term = new XTerm({
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 13,
    cursorBlink: true,
    convertEol: true,
    // Typing jumps back to the newest line, so a scrolled-back view never hides
    // what is being typed. Output scrolls along by itself unless the reader has
    // deliberately scrolled up.
    scrollOnUserInput: true,
    scrollback: 5000,
    theme: {
      background: token('--card', '#ffffff'),
      foreground: token('--card-foreground', '#111111'),
      cursor: token('--foreground', '#111111'),
      selectionBackground: token('--accent', '#dddddd'),
    },
  });
  const fit = new Fit();
  term.loadAddon(fit);
  term.open(host);

  const socket = new WebSocket(serverTerminalUrl(serverId, term.cols, term.rows));
  const session: LiveTerminal = {
    host,
    term,
    fit,
    socket,
    observer: new ResizeObserver(() => resize(session)),
    snapshot: { status: 'connecting', error: null, pinned: null },
    listeners: new Set(),
  };

  // The shell's output arrives as base64 frames that may split a character in
  // half, so one streaming decoder spans them all.
  const decoder = new TextDecoder();

  socket.onmessage = (event) => {
    const payload = JSON.parse(String(event.data)) as ServerMessage;
    if (payload.type === 'ready') publish(session, { status: 'connected' });
    else if (payload.type === 'data' && payload.data) {
      term.write(decoder.decode(base64ToBytes(payload.data), { stream: true }));
    } else if (payload.type === 'pinned' && payload.fingerprint) {
      publish(session, { pinned: payload.fingerprint });
    } else if (payload.type === 'error') {
      publish(session, { status: 'error', error: payload.message ?? 'The connection failed.' });
    } else if (payload.type === 'closed') {
      publish(session, { status: 'closed' });
    }
  };
  socket.onclose = () => {
    if (session.snapshot.status !== 'error') publish(session, { status: 'closed' });
  };
  socket.onerror = () =>
    publish(session, { status: 'error', error: 'Could not open the terminal connection.' });

  term.onData((data) => {
    term.scrollToBottom();
    sendText(session, data);
  });

  // Ctrl+C and Ctrl+V belong to the shell, so the terminal keeps the shifted pair
  // for the clipboard, the way a desktop terminal does. Shift+Insert is handled as
  // well, because that is what several people reach for first.
  term.attachCustomKeyEventHandler((event) => {
    if (event.type !== 'keydown') return true;
    const modifier = event.ctrlKey || event.metaKey;
    const shifted = event.shiftKey;
    if ((modifier && shifted && event.code === 'KeyV') || (shifted && event.code === 'Insert')) {
      void pasteInto(session);
      return false;
    }
    if (modifier && shifted && event.code === 'KeyC') {
      void copyFrom(session);
      return false;
    }
    return true;
  });

  // Right-click copies a selection and otherwise pastes, which is the habit most
  // people bring from PuTTY and Windows Terminal. It is bound to the terminal's own
  // element, so it travels with the session between visits.
  host.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    void copyFrom(session).then((copied) => {
      if (!copied) void pasteInto(session);
    });
  });

  resize(session);
  // The first fit runs on whatever font the browser had ready, which is not always
  // the monospace one. Measuring again once the real font is loaded is what keeps
  // the last line from ending up under the bottom edge.
  void document.fonts?.ready.then(() => resize(session));

  return session;
}

function acquire(serverId: number, container: HTMLElement): Promise<LiveTerminal> {
  const existing = live.get(serverId);
  if (existing && isUsable(existing)) return Promise.resolve(existing);
  if (existing) dispose(serverId);

  const pending = opening.get(serverId);
  if (pending) return pending;

  const started = createSession(serverId, container).then((session) => {
    live.set(serverId, session);
    opening.delete(serverId);
    return session;
  });
  opening.set(serverId, started);
  return started;
}

export function useServerTerminal(serverId: number | null, container: HTMLDivElement | null) {
  const [snapshot, setSnapshot] = useState<TerminalSnapshot>({
    status: 'connecting',
    error: null,
    pinned: null,
  });
  const sessionRef = useRef<LiveTerminal | null>(null);
  const [generation, setGeneration] = useState(0);

  const paste = useCallback(async () => {
    const session = sessionRef.current;
    if (session) await pasteInto(session);
  }, []);

  // Ends the shell and opens a new one. The only way a session is thrown away on
  // purpose, so an accidental click on another section never costs one.
  const reconnect = useCallback(() => {
    if (serverId != null) dispose(serverId);
    sessionRef.current = null;
    setSnapshot({ status: 'connecting', error: null, pinned: null });
    setGeneration((value) => value + 1);
  }, [serverId]);

  useEffect(() => {
    if (serverId == null || !container) return;
    let attached: LiveTerminal | null = null;

    void acquire(serverId, container).then((session) => {
      // The console was left again before the socket finished opening; the session
      // stays alive and is picked up on the next visit.
      if (!container.isConnected) return;
      attached = session;
      sessionRef.current = session;
      if (session.host.parentElement !== container) container.append(session.host);
      session.listeners.add(setSnapshot);
      setSnapshot(session.snapshot);
      session.observer.observe(container);
      resize(session);
      session.term.focus();
    });

    return () => {
      if (!attached) return;
      attached.listeners.delete(setSnapshot);
      attached.observer.disconnect();
      // Detached, not closed: the shell keeps running for the next visit.
      attached.host.remove();
      sessionRef.current = null;
    };
  }, [serverId, container, generation]);

  return { ...snapshot, paste, reconnect };
}
