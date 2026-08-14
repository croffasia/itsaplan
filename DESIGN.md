# DESIGN.md

Design tokens and principles for the planner web app (`apps/web`). Extracted from
the established system in `apps/web/src/app/globals.css` (Tailwind v4 `@theme` +
`:root`/`.dark` OKLCH variables). Those CSS variables are the source of truth; this
file mirrors them. When a token changes in `globals.css`, update it here in the same
change.

## Direction

Neutral, product-grade UI in the Linear / Vercel / Raycast register: monochrome
surfaces, borderless-first layout, hierarchy carried by type weight, spacing, and
subtle background shifts rather than boxes and lines. Calm and dense, not decorated.
This is an **app/tool** register — clarity over cleverness; no decoration that does
not aid comprehension.

## Tokens (intent-named; values live in `globals.css`)

Colors are OKLCH grayscale ramps with no brand hue; no surface sits on pure white or pure
black. Light and dark are both first-class (`.dark` class toggles; the app ships a theme
switch).

- `background` / `foreground` — page base and primary text.
- `card` / `card-foreground` — a raised surface (modals, popovers, kanban detail).
  Only a few percent off `background`; use a background shift, not a border, to raise.
- `muted` / `muted-foreground` — quiet fills and secondary text.
- `secondary` — the active/selected chip fill (tabs, toggles).
- `accent` / `accent-foreground` — hover fill for interactive rows/buttons.
- `border` — hairline; in dark it is `white / 10%`, i.e. a tint, never flat gray.
- `primary` — high-contrast solid (primary buttons); near-black in light, near-white
  in dark.
- `destructive` — error / overdue / delete only. It serves two roles at once: `text-destructive`
  on the page, and a fill under the white label of a destructive button or badge.
- `warning` — a state that needs attention but has refused nothing, where `destructive` would
  overstate it: a soft WIP limit is at its maximum while a hard one has blocked the move. Text
  and low-opacity tint only; there is no warning button, so it is tuned for the page background
  alone. An amber rather than a bright yellow — yellow at a legible chroma has to drop this far
  in lightness to hold contrast against the light page.
- `ring` — focus ring (keyboard a11y).
- `chart-1…5` — a neutral grayscale ramp for charts. For categorical series that need
  to be told apart (priority, assignee), widgets use their own small hue palette; for
  entity series (status, type) the entity's own color is used.
- `priority-low|medium|high|urgent` — fixed hues for the priority field.
- `sidebar-*` — the app sidebar surface (slightly off the page background).

## Scale & shape

- **Type:** Inter Variable (`--font-sans`, also `--font-heading`). Weight and size carry
  hierarchy — do not add display faces. Body ≥ 14px in dense chrome, ≥ 16px for reading.
- **Line-height:** the `--text-*--line-height` tokens in `globals.css` replace Tailwind's
  defaults, which are tuned for 16px prose and leave `text-xs`/`text-sm` cramped. Body sizes
  run 1.5–1.6; headings tighten as they grow (1.25 at `2xl` down to 1.1 at `4xl`) and take
  negative tracking from `2xl` up.
- **Radius:** base `--radius: 0.625rem`; scale `sm .6 · md .8 · lg 1 · xl 1.4 · 2xl 1.8`.
  Radius scales with element size; keep `padding ≥ radius`.
- **Spacing:** 8pt grid (4 as half-step). Proximity encodes relationship: inside a group
  < between groups < between sections.

## Principles

- **Borderless first.** Separate surfaces by whitespace → background shift → soft
  elevation, in that order. Add a hairline `border` only when those fail, and never a
  flat gray box around every block. No card-in-card. No decorative left-accent strip.
- **One focal point per view; one accent per action.** Reserve `primary` for the single
  main action; secondary actions are ghost/outline.
- **Depth over lines.** Raise a surface with a 3–5% background shift and a soft shadow,
  not a 1px border.
- **Contrast is measured, not eyeballed** — APCA: body `Lc ≥ 75`, large/bold `≥ 45`,
  non-text UI `≥ 30`. `destructive` in dark reaches only ~53 in each of its two roles: as it
  lightens it reads better as text on the near-black page and worse under the white label of
  a destructive button, so it sits where those two curves cross. Both roles are above the
  large/bold threshold; red at that chroma cannot do better without splitting the token.
- **Motion is restrained.** Hover 120–200ms, entrance 250–400ms; animate only
  `transform`/`opacity`; honor `prefers-reduced-motion`.

## Settings pages (account, project, god)

A settings page is a centered measure of stacked groups: a small heading with an optional
one-line explanation, then its rows, groups separated by space and a hairline rule — no box
around a group and no card per row. A row puts its name and explanation on the left and its
control in a fixed-width column on the right, so every control on the page lines up; below
`sm` the control drops under the text. A page whose changes save on the spot reports that in
the header (saving, then saved) rather than freezing its controls.

## Dashboards section (full-width, borderless)

The analytics dashboards render edge-to-edge inside the app shell: a full-width content
column (comfortable side padding, no narrow centered measure), widgets laid out on a
12-column grid, each widget a borderless section — a quiet header (title + its own
controls) over the body, separated from neighbors by space and a hairline divider under
the header, not by a card. Full-bleed widgets (stat strip, pulse) break the two-column
rhythm so the page is not one repeated shape.
