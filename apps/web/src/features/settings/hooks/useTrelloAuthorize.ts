import { useCallback, useEffect, useRef } from 'react';

const TRELLO_ORIGIN = 'https://trello.com';
// The api accepts only letters and digits in a token.
const TOKEN = /^[A-Za-z0-9]+$/;

// Opens Trello's authorize page for an API key in a popup. Trello sends the token
// back to this page with postMessage, and only when this page's origin is one of
// the key's allowed origins. Resolves with the token, or with null when the popup
// closes without one; rejects when the browser blocks the popup, which it does
// unless this is called from a click handler.
export function useTrelloAuthorize(): (apiKey: string) => Promise<string | null> {
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  return useCallback((apiKey: string) => {
    stop.current?.();
    const params = new URLSearchParams({
      expiration: '30days',
      scope: 'read',
      response_type: 'token',
      key: apiKey,
      callback_method: 'postMessage',
      return_url: window.location.origin,
    });
    const popup = window.open(
      `${TRELLO_ORIGIN}/1/authorize?${params}`,
      'trello-authorize',
      'popup,width=600,height=720',
    );
    if (!popup) return Promise.reject(new Error('the browser blocked the Trello window'));

    return new Promise<string | null>((resolve) => {
      function onMessage(event: MessageEvent) {
        if (event.origin !== TRELLO_ORIGIN || event.source !== popup) return;
        popup!.close();
        finish(typeof event.data === 'string' && TOKEN.test(event.data) ? event.data : null);
      }
      const closed = setInterval(() => {
        if (popup.closed) finish(null);
      }, 500);
      function finish(token: string | null) {
        window.removeEventListener('message', onMessage);
        clearInterval(closed);
        stop.current = null;
        resolve(token);
      }
      window.addEventListener('message', onMessage);
      stop.current = () => finish(null);
    });
  }, []);
}
