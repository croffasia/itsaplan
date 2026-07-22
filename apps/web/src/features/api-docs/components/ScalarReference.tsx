'use client';

import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';
import './scalar-theme.css';

// The API mounts /docs/json outside the session guard, so the browser fetches it
// directly.
const SPEC_URL = `${process.env.NEXT_PUBLIC_API_URL}/docs/json`;

// The app owns the light/dark switch (next-themes), so Scalar's mode is forced to
// match and its own toggle is hidden. Theming: scalar-theme.css.
export default function ScalarReference({ dark }: { dark: boolean }) {
  return (
    <div className="itp-scalar min-h-0 flex-1 overflow-y-auto">
      <ApiReferenceReact
        configuration={{
          url: SPEC_URL,
          forceDarkModeState: dark ? 'dark' : 'light',
          hideDarkModeToggle: true,
          agent: { disabled: true },
          // The app already exposes its own MCP server; hide Scalar's built-in
          // "Generate MCP" button.
          mcp: { disabled: true },
          // App owns Cmd/Ctrl+K for its command palette; move Scalar's search
          // hotkey off it so the two don't collide.
          searchHotKey: 'j',
        }}
      />
    </div>
  );
}
