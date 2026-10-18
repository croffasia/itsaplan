import type { ReactNode } from 'react';

// Drawn on the 24px grid with a 2px round stroke. `fill` is the closed shape the
// filled variant tints under the line.
type IconDef = { line: ReactNode; fill: ReactNode };

export const ICONS = {
  agent: {
    line: (
      <>
        <rect x="4" y="8" width="16" height="12" rx="3" />
        <path d="M12 8V4" />
        <circle cx="12" cy="3" r="1" />
        <path d="M9 13v1" />
        <path d="M15 13v1" />
        <path d="M2 13v2" />
        <path d="M22 13v2" />
      </>
    ),
    fill: <rect x="4" y="8" width="16" height="12" rx="3" />,
  },
  run: {
    line: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m10 8 6 4-6 4Z" />
      </>
    ),
    fill: <circle cx="12" cy="12" r="9" />,
  },
  schedule: {
    line: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 3v4" />
        <path d="M16 3v4" />
        <path d="M12 14v3h2" />
      </>
    ),
    fill: <rect x="3" y="5" width="18" height="16" rx="2" />,
  },
  budget: {
    line: (
      <>
        <path d="M3 12a9 9 0 1 1 18 0" />
        <path d="m12 12 4-4" />
        <circle cx="12" cy="12" r="1.5" />
        <path d="M5 17h14" />
        <path d="M8 21h8" />
      </>
    ),
    fill: <path d="M3 12a9 9 0 1 1 18 0v5H3Z" />,
  },
  approval: {
    line: (
      <>
        <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" />
        <path d="m8.5 12 2.5 2.5 4.5-5" />
      </>
    ),
    fill: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" />,
  },
  audit: {
    line: (
      <>
        <path d="M6 3h9l4 4v14H6Z" />
        <path d="M14 3v5h5" />
        <path d="M9 12h6" />
        <path d="M9 16h4" />
      </>
    ),
    fill: <path d="M6 3h9l4 4v14H6Z" />,
  },
  webhook: {
    line: (
      <>
        <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2" />
        <path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06" />
        <path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8" />
      </>
    ),
    fill: <circle cx="12" cy="12" r="5" />,
  },
  api: {
    line: (
      <>
        <path d="m8 7-5 5 5 5" />
        <path d="m16 7 5 5-5 5" />
        <path d="m14 4-4 16" />
      </>
    ),
    fill: <rect x="6" y="6" width="12" height="12" rx="3" />,
  },
  mcp: {
    line: (
      <>
        <circle cx="12" cy="12" r="3" />
        <circle cx="4" cy="5" r="2" />
        <circle cx="20" cy="5" r="2" />
        <circle cx="12" cy="21" r="1.5" />
        <path d="m5.5 6.5 4.3 3.6" />
        <path d="m18.5 6.5-4.3 3.6" />
        <path d="M12 15v4.5" />
      </>
    ),
    fill: <circle cx="12" cy="12" r="5" />,
  },
  runner: {
    line: (
      <>
        <rect x="2" y="4" width="20" height="13" rx="2" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="m7 9 3 2-3 2" />
        <path d="M12 13h4" />
      </>
    ),
    fill: <rect x="2" y="4" width="20" height="13" rx="2" />,
  },
  'self-host': {
    line: (
      <>
        <path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
        <rect x="8" y="12" width="8" height="3" rx="1" />
        <path d="M8 18h8" />
      </>
    ),
    fill: <path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />,
  },
  server: {
    line: (
      <>
        <rect x="3" y="3" width="18" height="8" rx="2" />
        <rect x="3" y="13" width="18" height="8" rx="2" />
        <path d="M7 7h.01" />
        <path d="M7 17h.01" />
      </>
    ),
    fill: (
      <>
        <rect x="3" y="3" width="18" height="8" rx="2" />
        <rect x="3" y="13" width="18" height="8" rx="2" />
      </>
    ),
  },
  database: {
    line: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
      </>
    ),
    fill: <path d="M4 5c0-1.7 3.6-3 8-3s8 1.3 8 3v14c0 1.7-3.6 3-8 3s-8-1.3-8-3Z" />,
  },
  key: {
    line: (
      <>
        <circle cx="7.5" cy="15.5" r="4.5" />
        <path d="m10.7 12.3 9.3-9.3" />
        <path d="m16 7 3 3" />
        <path d="m18 5 2 2" />
      </>
    ),
    fill: <circle cx="7.5" cy="15.5" r="4.5" />,
  },
  lock: {
    line: (
      <>
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        <path d="M12 15v2" />
      </>
    ),
    fill: <rect x="4" y="11" width="16" height="10" rx="2" />,
  },
  shield: {
    line: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" />,
    fill: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" />,
  },
  import: {
    line: (
      <>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
      </>
    ),
    fill: <path d="M4 15h16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />,
  },
  board: {
    line: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M8 7v7" />
        <path d="M12 7v4" />
        <path d="M16 7v9" />
      </>
    ),
    fill: <rect x="3" y="3" width="18" height="18" rx="2" />,
  },
  cycle: {
    line: (
      <>
        <path d="M21 12a9 9 0 0 1-15.5 6.2" />
        <path d="M3 12A9 9 0 0 1 18.5 5.8" />
        <path d="M19 2v4h-4" />
        <path d="M5 22v-4h4" />
      </>
    ),
    fill: <circle cx="12" cy="12" r="6" />,
  },
  docs: {
    line: (
      <>
        <path d="M4 19.5V5a2 2 0 0 1 2-2h14v15H6.5a2.5 2.5 0 0 0 0 5H20" />
        <path d="M9 8h7" />
        <path d="M9 12h5" />
      </>
    ),
    fill: <path d="M4 19.5V5a2 2 0 0 1 2-2h14v15H6.5A2.5 2.5 0 0 0 4 19.5Z" />,
  },
  notes: {
    line: (
      <>
        <path d="M5 3h14v12l-6 6H5Z" />
        <path d="M13 21v-6h6" />
        <path d="M9 8h6" />
        <path d="M9 12h3" />
      </>
    ),
    fill: <path d="M5 3h14v12l-6 6H5Z" />,
  },
  dashboard: {
    line: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </>
    ),
    fill: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
      </>
    ),
  },
  chat: {
    line: (
      <>
        <path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z" />
        <path d="M8 12h.01" />
        <path d="M12 12h.01" />
        <path d="M16 12h.01" />
      </>
    ),
    fill: <path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z" />,
  },
  mention: {
    line: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
      </>
    ),
    fill: <circle cx="12" cy="12" r="4" />,
  },
  team: {
    line: (
      <>
        <circle cx="9" cy="8" r="4" />
        <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" />
        <path d="M16 4.1a4 4 0 0 1 0 7.8" />
        <path d="M22 21v-1a6 6 0 0 0-3-5.2" />
      </>
    ),
    fill: <circle cx="9" cy="8" r="4" />,
  },
  workspace: {
    line: (
      <>
        <path d="m12 2 9 5-9 5-9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 17 9 5 9-5" />
      </>
    ),
    fill: <path d="m12 2 9 5-9 5-9-5Z" />,
  },
  sso: {
    line: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21a7 7 0 0 1 9-6.7" />
        <rect x="15" y="17" width="6" height="5" rx="1" />
        <path d="M16.5 17v-1.5a1.5 1.5 0 0 1 3 0V17" />
      </>
    ),
    fill: <circle cx="12" cy="8" r="4" />,
  },
  translate: {
    line: (
      <>
        <path d="m5 8 6 6" />
        <path d="m4 14 6-6 2-3" />
        <path d="M2 5h12" />
        <path d="M7 2h1" />
        <path d="m22 22-5-10-5 10" />
        <path d="M14 18h6" />
      </>
    ),
    fill: <path d="m17 12 5 10H12Z" />,
  },
  'local-model': {
    line: (
      <>
        <rect x="5" y="5" width="14" height="14" rx="2" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
        <path d="M9 2v3" />
        <path d="M15 2v3" />
        <path d="M9 19v3" />
        <path d="M15 19v3" />
        <path d="M2 9h3" />
        <path d="M2 15h3" />
        <path d="M19 9h3" />
        <path d="M19 15h3" />
      </>
    ),
    fill: <rect x="5" y="5" width="14" height="14" rx="2" />,
  },
  'sparkle-ai': {
    line: (
      <>
        <path d="M10 3 11.8 8.2 17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8Z" />
        <path d="M19 15v4" />
        <path d="M17 17h4" />
        <path d="M18 3v2" />
        <path d="M17 4h2" />
      </>
    ),
    fill: <path d="M10 3 11.8 8.2 17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8Z" />,
  },
  check: {
    line: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    fill: <circle cx="12" cy="12" r="9" />,
  },
  clock: {
    line: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    fill: <circle cx="12" cy="12" r="9" />,
  },
  // Points in the reading direction; the caller mirrors it for right-to-left text.
  arrow: {
    line: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    fill: <circle cx="12" cy="12" r="9" />,
  },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;
