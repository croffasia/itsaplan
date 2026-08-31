import { t } from 'elysia';
import { HotkeyCombosSchema } from '#modules/settings/model';

const Locale = t.Union([
  t.Literal('en'),
  t.Literal('uk'),
  t.Literal('ru'),
  t.Literal('zh-CN'),
  t.Literal('ar'),
  t.Literal('fr'),
]);
const Theme = t.Union([t.Literal('light'), t.Literal('dark'), t.Literal('system')]);
const IssueOpenMode = t.Union([t.Literal('panel'), t.Literal('page')]);
const StartPage = t.Union([
  t.Literal('inbox'),
  t.Literal('dashboard'),
  t.Literal('work-items'),
  t.Literal('initiatives'),
]);
const IssueStatsView = t.Union([t.Literal('compact'), t.Literal('timeline')]);
const IssueActivityView = t.Union([t.Literal('flat'), t.Literal('grouped')]);

export const PreferenceResponse = t.Object({
  timezone: t.String(),
  locale: Locale,
  theme: Theme,
  issueOpenMode: IssueOpenMode,
  startPage: StartPage,
  showChatByDefault: t.Boolean(),
  issueStatsOpen: t.Boolean(),
  issueStatsView: IssueStatsView,
  issueActivityView: IssueActivityView,
  autoWatch: t.Boolean(),
  lastProjectId: t.Nullable(t.Number()),
  hotkeys: HotkeyCombosSchema,
});

export const PreferencePatch = t.Object({
  timezone: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
  locale: t.Optional(Locale),
  theme: t.Optional(Theme),
  issueOpenMode: t.Optional(IssueOpenMode),
  startPage: t.Optional(StartPage),
  showChatByDefault: t.Optional(t.Boolean()),
  issueStatsOpen: t.Optional(t.Boolean()),
  issueStatsView: t.Optional(IssueStatsView),
  issueActivityView: t.Optional(IssueActivityView),
  autoWatch: t.Optional(t.Boolean()),
  lastProjectId: t.Optional(t.Nullable(t.Number())),
  hotkeys: t.Optional(HotkeyCombosSchema),
});
