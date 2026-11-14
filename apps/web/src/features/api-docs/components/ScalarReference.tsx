'use client';

import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';
import './scalar-theme.css';

// The app owns the light/dark switch (next-themes), so Scalar's mode is forced to
// match and its own toggle is hidden. Theming: scalar-theme.css.
export default function ScalarReference({
  spec,
  dark,
}: {
  spec: Record<string, unknown>;
  dark: boolean;
}) {
  return (
    <div className="itp-scalar min-h-0 flex-1 overflow-y-auto">
      <ApiReferenceReact
        configuration={{
          // The api serves the spec only with a session, so the page loads it itself.
          content: spec,
          forceDarkModeState: dark ? 'dark' : 'light',
          hideDarkModeToggle: true,
          // Scalar's default fonts are loaded from fonts.scalar.com, which the
          // Content-Security-Policy blocks. The theme maps --scalar-font to the app
          // font anyway, so its own faces are not needed.
          withDefaultFonts: false,
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
