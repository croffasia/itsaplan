# Web UI components

Code: `apps/web/src/components/ui`, `apps/web/src/components/common`. Commit `42fd2f40`.

## 1. Purpose

`components/ui` is the shadcn/ui primitive set. `components/common` holds components that more than
one feature uses. A feature imports both with the `@/components/...` alias and never imports another
feature (`apps/web/AGENTS.md`). The one exception is `work-items`, which may compose presentational
components of `issue`.

## 2. Routes and screens

None. The shell screens that use them are captured in `web-shell.md`; module screens are in the module documents.

## 3. Components

### `components/ui` (38 files, shadcn/ui, Tailwind v4)

alert, attachment, badge, bubble, button, calendar, card, chart, checkbox, collapsible, combobox,
command, context-menu, dialog, dropdown-menu, empty, field, input-group, input, item, label, marker,
message-scroller, message, pagination, popover, progress, select, separator, sheet, sidebar, skeleton,
sonner (toast), switch, table, tabs, textarea, tooltip.

### `components/common`

| Folder | Components | Used for |
| --- | --- | --- |
| root | `AppLogo`, `Avatar`, `ArchivedBadge`, `CodeBlock`, `DisclosureCard`, `DocumentLinkList`, `DocumentTitle`, `ListPager`, `Markdown`, `PageNav`, `ProgressBar`, `ResizeGrip`, `RowAction`, `SearchInput`, `ShowMoreButton`, `LegacyRedirect`, `IntegrationIcon`, `GoogleIcon`, `GithubIcon`, `MemberProvisionedBadge` | small shared pieces: list paging, search, markdown rendering, badges |
| `fields` | `AssigneeSelect`, `StatusSelect`, `PrioritySelect`, `TypeSelect`, `LabelPicker`, `LabelsSelect`, `DatePill`, `DateTimePill`, `TimeInput`, `Pill`, `ReadOnlyPill`, `PopoverPick`, `OnOffStatus`, `InitiativeStatusSelect` | the issue property pickers |
| `overlay` | `Modal`, `ConfirmDialog`, `IssuePickerDialog`, `InitiativeDialog` | dialogs |
| `page` | `PageHeader`, `EmptyState`, `FullPageView`, `SectionPageView`, `SectionNav`, `SettingsCard`, `SettingsRow`, `SettingsSection`, `CopyableValue`, `TakeoverScreen`, `BrandPanel`, `PublicShareFrame`, `PublicShareHeader`, `AuditLogPreview`, `SectionPreview`, `MembersEmptyState` | page frames and settings layout |
| `permissions` | `RequirePermission`, `RequireFeature`, `PermissionMatrix`, `PermissionsPopover`, `AccessCard`, `MemberAccessCard`, `MemberProfileDetails` | hide UI the viewer may not use; role editing |
| `editor` | `MarkdownEditor` and its menus, link-preview components, `IssueRefChip` | rich text editor |
| `attachments` | `AttachmentThumb`, `AttachmentViewer` | attachment display |
| `chart` | `ChartBlock`, `ChartDownload` | chart rendering (see the dashboards module) |
| `agent-chat`, `agent-runs` | chat panel, transcript, tool-call blocks; run trace and steps | AI agent UI |
| `inputs` | `SecretInput`, `EnabledSwitch`, `ProviderToggle` | form inputs |
| `hotkeys` | `HotkeysEditor`, `HotkeysEditorRow` | shortcut editing |
| `share` | `ShareDialog` | sharing an issue or view by link |
| `timeline` | `TimelineHeader`, `TimelineLabelResizer` | timeline layout |
| `skeleton` | loading placeholders | |

## 4. API endpoints

None called directly except where a component takes data through props or hooks (see
`web-data.md`).

## 5. Database tables

None.

## 6. Permissions

`RequirePermission` and `RequireFeature` gate children with the hooks in
`web-auth-permissions-i18n.md`.

## 7. Dependencies

Packages the code imports: `radix-ui` and 11 `@radix-ui/react-*` packages, `next-intl`, `sonner`,
`@tanstack/react-query`, the tiptap packages (`@tiptap/*`, 3.32.0) for the `editor` folder, and `cn`
(`@/lib/utils` re-exports `cn` from the npm package `cn`). Read `apps/web/package.json` for versions. `components/common` imports `@/lib`, `@/hooks`,
`@/context`, `@/utils`; it never imports a feature.

## 8. Running it in isolation

A test repo copies `apps/web/src/components/ui`, the `components/common` folders it needs, and the
`@/lib`, `@/hooks`, `@/utils` and `@/context` files those import. Start from the folders with the fewest outside imports: `inputs`, `chart` and `page`. Install the packages named in section 7 (the radix packages, `cn`, `class-variance-authority`,
`lucide-react`, and tiptap for `editor`) and set up Tailwind v4 with the tokens in
`apps/web/src/app/globals.css`.

## 9. Unconfirmed claims

- The props of each `common` component are not listed here; read the file's props type.
- The minimal copy set for each `common` folder has not been computed.
- Screens that render these components are in `web-shell.md`; no component is captured on its own.

## REA evidence

Captured on 2026-10-21 against the local instance with the seed accounts, in headless Chrome
(1280 x 720). Four captures, exported as one bundle (sha256
`d1529194cc17d7ae905311317fee8dd955e5aec0c46062cf60d4b9320a56a8e3`, 4 records, 0 unknowns):

| Capture | Evidence id |
| --- | --- |
| Login page | `ev_37f4fc1c1076a9be236da39fbce51f0bd73571fdd920103771f9c56f3939f28b` |
| Owner sign-in, first screen (What's new dialog open) | `ev_29f598cc616e3a44b1269c3b20982430248f5ce4753503fa67bc6394e0efa9be` |
| Owner: dismiss the dialog, open project, open command palette | `ev_8b5974fee6fbfee98fbf120f87d554a1241bb0503540a6b5b7dafb3d1ee64053` |
| Member: same steps | `ev_ce8ebc19aaf2287bce26c168e7e3dae53c3d377e6e8ac2c1dd404d62f144924e` |

The bundle file is not in the repo. Screenshots are in `docs/modules/_shared/screens`.
