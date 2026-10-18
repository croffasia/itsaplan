# One Health brand guide

Generated on 2026-10-17 from the working tree, which includes an uncommitted rebrand from
"It's a Plan" to "One Health". `brand.json` is the source of truth. Each value there has a
`source` and a `confidence`. `tokens.css` and `tailwind.theme.css` are generated from it.
`board.html` shows the swatches, logos and type.

## 1. Names

| Field                        | Value                                       | Source                                                          |
| ---------------------------- | ------------------------------------------- | --------------------------------------------------------------- |
| Product (EN)                 | One Health                                  | `apps/web/src/utils/app.ts:5`, `apps/web/src/app/manifest.ts:9` |
| Product (AR)                 | One Health (Latin, kept inside Arabic copy) | `apps/web/messages/ar/meta.json:2`                              |
| Descriptor                   | Issue tracking for people and agents        | `apps/web/messages/en/meta.json:2`                              |
| Repo / package / images      | `itsaplan`, `ghcr.io/croffasia/itsaplan-*`  | `package.json:2`, `AGENTS.md`                                   |
| Domain                       | itsaplan.dev, itsaplan.dev/pro              | `apps/web/src/utils/app.ts:8,11`                                |
| Sub-brands                   | Pro edition, `@itsaplan/runner`             | `app.ts:11`, `AGENTS.md`                                        |
| License                      | AGPL-3.0-only                               | `package.json:4`                                                |
| Legal entity | Andrii Poluosmak (project owner) | `ICLA.md:6` |
| Social handles | MISSING | — |

## 2. Verbal identity

- Tagline EN: "Issue tracking for people and agents."
- Tagline AR: "تتبّع المهام للأشخاص والوكلاء"
- Value proposition: AI agents work like any teammate. Everything is available over the REST
  API, webhooks and MCP. It runs on your server, with your database and your API keys. There
  are no per-seat fees and no lock-in. (`README.md:8-37`)
- Tone: plain, literal, direct, technical, unhyped (`AGENTS.md`, "Writing style").
  - Do: "Assign work to people or agents." "Data is stored in Postgres."
  - Don't: "the heart of the step", "self-healing queue", dramatised importance.
- Case: sentence case for UI and headings. The name is always "One Health".
- CTAs: short and verb-first, for example "Deploy on Railway" and "Star the repo".

## 3. Logo system

| File                                            | Use                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| `logo/mark-light.svg`                           | Mark on light surfaces: ink ring, grey arrow                            |
| `logo/mark-dark.svg`                            | Mark on dark surfaces: white ring, mint arrow                           |
| `logo/mark-mono.svg`                            | Single colour (`currentColor`)                                          |
| `logo/lockup-light.svg`, `logo/lockup-dark.svg` | "One" with the mark as the O, over a letter-spaced "HEALTH"             |
| `logo/app-icon.svg`                             | Teal `#006264` square with a 7/32 corner radius, white ring, mint arrow |

The arrow is grey on light surfaces and mint on dark ones, through `--logo-arrow`
(`AppLogo.tsx:1-2`). Clear space and minimum size are MISSING. Proposed values: clear space
equal to the arrow height on every side, a minimum of 16 px for the mark, and a minimum width
of 96 px for the lockup. Misuse: do not recolour the arrow outside these pairings, do not
rotate or outline the mark, and do not use the "It's a Plan" files in `assets/`.

## 4. Colour

Brand: teal `#006264` · mint `#7dccba` · grey `#989898` · ink `#232323`
(`apps/web/src/app/globals.css:80-83`).

| Role        | Light                                | Dark                 |
| ----------- | ------------------------------------ | -------------------- |
| background  | `#f8fbfb`                            | `#121717`            |
| foreground  | oklch 0.18                           | oklch 0.965          |
| primary     | `#006264` (teal)                     | `#7dccba` (mint)     |
| accent      | oklch 0.945 0.022 185                | oklch 0.32 0.035 195 |
| destructive | oklch 0.505 0.21 27                  | oklch 0.77 0.18 22   |
| warning     | oklch 0.56 0.13 75                   | oklch 0.82 0.14 80   |
| chart-1…5   | teal → mint-teal → grey → near-black | mint → teal → grey   |

`brand.json` → `color.roles` has the hex value of every role. `color.contrast` has the WCAG
ratios.

## 5. Typography

- Latin: `InterVariable` from `inter-ui` ^4.1.1. Headings use the same face.
- Arabic: IBM Plex Sans Arabic (OFL) from `@fontsource/ibm-plex-sans-arabic`, weights 400 to
  700, Arabic subset only. `--font-arabic` in `globals.css` (`--oh-font-arabic` in
  `tokens.css`) applies to `:lang(ar)` and `[dir=rtl]`; Latin characters fall back to Inter.
- Line heights: xs and sm 1.5, base 1.6, lg 1.55, xl 1.4, 2xl 1.25, 3xl 1.15, 4xl 1.1.
- Tracking: 2xl −0.01em, 3xl −0.02em, 4xl −0.025em.

## 6. Layout and shape

- Radius: base 0.625rem, from sm (0.6×) to 4xl (2.6×).
- Spacing and breakpoints: Tailwind v4 defaults.
- Borders: 1 px `--border`. In dark mode, white at 12%.
- Shadows: `--overlay-shadow`, `--modal-shadow`, `--side-panel-shadow`. They are about 3× darker
  in dark mode.

## 7. Iconography and illustration

- Icons: lucide (24 px grid, 2 px stroke, round caps and joins), from `components.json:13`.
- Illustration motifs in `components/brand/hero/*`: orbit rings, a pulse (ECG) line, a
  sparkline, radial progress, mini bars.

## 8. Motion

- UI transitions take 100 ms. Ambient loops run 3–60 s with `ease-in-out`. Line draw-ins use
  `ease-out`. Rotations are `linear`.
- Signature animations: counter-rotating orbit rings, the ECG stroke draw, and the OrbitMark
  breathe and nudge on the system screens.
- Reduced motion: every ambient animation is inside
  `@media (prefers-reduced-motion: no-preference)`.

## 9. Components

shadcn/ui (new-york) using the tokens above. Button variants: default (primary), destructive,
outline, secondary, ghost and link. The radius is `lg`.

## Gaps and conflicts

### Conflicts

1. **The name differs between sources.** The working tree says "One Health"
   (`app.ts`, `manifest.ts`, meta, README). The repo name, package, images, domain
   (`itsaplan.dev`), Railway template (`its-a-plan`) and `assets/*` still say "It's a Plan".
   I followed the higher-priority source, the code tokens and copy, and recorded both names.
2. **Legal texts keep the old name.** `ICLA.md` and `.github/workflows/cla.yml` still say
   "It's a Plan". They are the contributor agreement, so only the project owner should change them.
3. **The name does not match the category.** "One Health" is an established WHO, FAO and WOAH
   term for public health. The ECG motif also points to health care. The product is an issue
   tracker. This hurts search and creates a trademark risk. A human decision is needed.
4. **The README headline names competitors** ("alternative to Linear, Jira…"). This is fine
   for SEO, but the brand line should not depend on other products' names.

### Missing

Social handles, logo clear space and minimum size, and any
Figma, Canva or Drive brand kit. No connected design source was checked in this pass.

### Accessibility (WCAG AA)

| Pair                                            | Ratio            | Result                                    |
| ----------------------------------------------- | ---------------- | ----------------------------------------- |
| priority-medium `#a16207` on background, card (light) | 4.73, 4.91 | Passes AA text |
| priority-high `#ea580c` on background, card (light) | 3.42, 3.55 | Passes for UI elements, fails as text |
| priority-urgent `#d65530` on background, card (light) | 3.88, 4.03 | Passes for UI elements, fails as text |
| mint `#7dccba` on white                         | 1.87             | Use it only on dark surfaces or as a fill |
| grey `#989898` on white (logo arrow)            | 2.88             | Acceptable for a logo, fails as text      |
| chart-2, chart-3, chart-4 on background (light) | 3.34, 4.47, 4.11 | Pass for UI elements, fail as text        |

The light priority colours keep the hue of the dark-theme values (`#eab308`, `#f97316`,
`#f2683c`), which stay as they are. Background is `#f8fbfb`, card `#feffff`.

Every foreground/background text pair passes AA in both themes, including primary on
primary-foreground.
