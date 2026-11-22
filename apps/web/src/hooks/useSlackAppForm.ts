'use client';

import { useState } from 'react';
import type { SlackApp, SlackAppPatch } from '@/lib/api/endpoints/slack';

export interface SlackAppForm {
  botToken: string;
  setBotToken: (v: string) => void;
  clientId: string;
  setClientId: (v: string) => void;
  clientSecret: string;
  setClientSecret: (v: string) => void;
  // Every part is either stored or typed in, so the app can be turned on.
  complete: boolean;
  dirty: boolean;
  // What changed: a secret goes only when typed in, so a masked field keeps its value.
  patch: SlackAppPatch;
  reset: () => void;
}

// The fields of a Slack app, shared by the instance app in god mode and a workspace's own.
export function useSlackAppForm(app: SlackApp): SlackAppForm {
  const [botToken, setBotToken] = useState('');
  const [clientId, setClientId] = useState(app.clientId);
  const [clientSecret, setClientSecret] = useState('');

  const patch: SlackAppPatch = {
    ...(botToken.trim() && { botToken: botToken.trim() }),
    ...(clientId.trim() !== app.clientId && { clientId: clientId.trim() }),
    ...(clientSecret.trim() && { clientSecret: clientSecret.trim() }),
  };
  const complete =
    (app.hasBotToken || botToken.trim() !== '') &&
    clientId.trim() !== '' &&
    (app.hasClientSecret || clientSecret.trim() !== '');

  return {
    botToken,
    setBotToken,
    clientId,
    setClientId,
    clientSecret,
    setClientSecret,
    complete,
    dirty: Object.keys(patch).length > 0,
    patch,
    reset: () => {
      setBotToken('');
      setClientSecret('');
    },
  };
}
