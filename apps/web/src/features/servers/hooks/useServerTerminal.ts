'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { serverTerminalUrl } from '@/lib/api';

export type TerminalStatus = 'connecting' | 'connected' | 'closed' | 'error';

interface ServerMessage {
  type: 'ready' | 'data' | 'error' | 'closed' | 'pinned';
  data?: string;
  message?: string;
  fingerprint?: string;
}

// Wires an xterm instance to the terminal WebSocket. The terminal is created only
// in the browser (xterm touches the DOM at import time), so the modules are loaded
// on mount rather than at module scope, which would break the server render.
export function useServerTerminal(serverId: number | null, container: HTMLDivElement | null) {
  const [status, setStatus] = useState<TerminalStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const disposeRef = useRef<(() => void) | null>(null);

  const close = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    disposeRef.current?.();
    disposeRef.current = null;
  }, []);

  useEffect(() => {
    if (serverId == null || !container) return;
    let cancelled = false;

    void (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
      ]);
      if (cancelled) return;

      // Reads the page's own tokens, so the terminal follows the dashboard theme
      // instead of shipping a second palette.
      const style = getComputedStyle(document.documentElement);
      const token = (name: string, fallback: string) =>
        style.getPropertyValue(name).trim() || fallback;

      const term = new Terminal({
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 13,
        cursorBlink: true,
        convertEol: true,
        theme: {
          background: token('--card', '#ffffff'),
          foreground: token('--card-foreground', '#111111'),
          cursor: token('--foreground', '#111111'),
          selectionBackground: token('--accent', '#dddddd'),
        },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(container);
      fit.fit();

      const socket = new WebSocket(serverTerminalUrl(serverId, term.cols, term.rows));
      socketRef.current = socket;

      socket.onmessage = (event) => {
        const payload = JSON.parse(String(event.data)) as ServerMessage;
        if (payload.type === 'ready') setStatus('connected');
        else if (payload.type === 'data' && payload.data) {
          term.write(atob(payload.data));
        } else if (payload.type === 'pinned' && payload.fingerprint) {
          setPinned(payload.fingerprint);
        } else if (payload.type === 'error') {
          setStatus('error');
          setError(payload.message ?? 'The connection failed.');
        } else if (payload.type === 'closed') {
          setStatus('closed');
        }
      };
      socket.onclose = () => setStatus((current) => (current === 'error' ? current : 'closed'));
      socket.onerror = () => {
        setStatus('error');
        setError('Could not open the terminal connection.');
      };

      term.onData((data) => {
        if (socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({ type: 'input', data: btoa(data) }));
      });

      const resize = () => {
        fit.fit();
        if (socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      };
      const observer = new ResizeObserver(resize);
      observer.observe(container);

      disposeRef.current = () => {
        observer.disconnect();
        term.dispose();
      };
    })();

    return () => {
      cancelled = true;
      close();
    };
  }, [serverId, container, close]);

  return { status, error, pinned, close };
}
