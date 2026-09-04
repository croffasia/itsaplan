// Query keys shared by every service. Each is a stable tuple; a project/issue id
// or key scopes its entry. Kept in one registry so a mutation in one service can
// invalidate another service's queries by the same key.
export const qk = {
  projects: ['projects'] as const,
  teams: ['teams'] as const,
  // One team: its counters and what the caller may do with what it holds.
  team: (teamId: number) => ['team', teamId] as const,
  // The members of a team and the projects it owns, each read by its own section. A
  // member page is scoped by the search term and the window it was read with.
  teamMembers: (teamId: number, params: unknown) => ['team', teamId, 'members', params] as const,
  teamProjects: (teamId: number) => ['team', teamId, 'projects'] as const,
  // One project the team owns, loaded when its row is opened, and one page of its
  // members (the search term and the window scope the entry).
  teamProject: (teamId: number, projectId: number) =>
    ['team', teamId, 'project', projectId] as const,
  teamProjectMembers: (teamId: number, projectId: number, params: unknown) =>
    ['team', teamId, 'project', projectId, 'members', params] as const,
  // Every team detail and every project of one, for a write that changes what any
  // of them shows (a project gained or lost a member).
  anyTeam: ['team'] as const,
  // A team's notification provider credentials.
  notificationSettings: (teamId: number) => ['notificationSettings', teamId] as const,
  // The board scaffold (columns/types/labels/fields/viewer) for a project.
  project: (projectKey: string) => ['workItems', projectKey] as const,
  // Every project scaffold, for a write outside the project that changes what one
  // of them shows (a team setting the project inherits).
  anyProject: ['workItems'] as const,
  // The board's issues, their relations and the change marker for a project.
  // Split from the scaffold so issue writes and live-refresh touch only the
  // issues, not the scaffold.
  boardIssues: (projectKey: string) => ['boardIssues', projectKey] as const,
  // A project's archived issues.
  archivedIssues: (projectKey: string) => ['archivedIssues', projectKey] as const,
  // Command-palette issue search, scoped to a project and the search term.
  issueSearch: (projectKey: string, q: string) => ['issueSearch', projectKey, q] as const,
  // The project's auto-archive thresholds and subtask automations (the
  // Configuration settings section).
  autoArchive: (projectKey: string) => ['autoArchive', projectKey] as const,
  subtaskAutomation: (projectKey: string) => ['subtaskAutomation', projectKey] as const,
  // The project's repository integration settings (the Repositories settings section).
  gitSettings: (projectKey: string) => ['gitSettings', projectKey] as const,
  gitConnections: (projectKey: string) => ['gitConnections', projectKey] as const,
  gitAvailableRepositories: (projectKey: string, connectionId: number, search: string) =>
    ['gitConnections', projectKey, connectionId, 'repositories', search] as const,
  // The member's own notification preferences for a project.
  notificationPreferences: (projectKey: string) => ['notificationPreferences', projectKey] as const,
  views: (projectKey: string) => ['views', projectKey] as const,
  actions: (projectKey: string) => ['actions', projectKey] as const,
  webhooks: (projectKey: string) => ['webhooks', projectKey] as const,
  webhookDeliveries: (webhookId: number) => ['webhookDeliveries', webhookId] as const,
  // Saved dashboards (the analytics tabs) and the read-only metrics behind their
  // widgets. `kind` names the metric (stats/pulse/throughput/breakdown/...) and
  // `params` scopes it to the widget's query (window, filters).
  dashboards: (projectKey: string) => ['dashboards', projectKey] as const,
  // Note boards (the notes canvases). `noteBoardsForProject` is the invalidation
  // base for every list/search variant; `noteBoardsSearch` is one paged switcher
  // query (scoped by search text); `noteBoard` is a single board with its canvas.
  noteBoardsForProject: (projectKey: string) => ['noteBoards', projectKey] as const,
  noteBoardsSearch: (projectKey: string, q: string) =>
    ['noteBoards', projectKey, 'search', q] as const,
  noteBoard: (projectKey: string, boardId: number) =>
    ['noteBoards', projectKey, 'board', boardId] as const,
  noteBoardAccessCandidates: (projectKey: string) =>
    ['noteBoards', projectKey, 'accessCandidates'] as const,
  analytics: (projectKey: string, kind: string, params?: unknown) =>
    ['analytics', projectKey, kind, params ?? {}] as const,
  analyticsForProject: (projectKey: string) => ['analytics', projectKey] as const,
  // Project membership and invite links (the Members section).
  members: (projectKey: string) => ['members', projectKey] as const,
  // One page of them. Under the key above, so a membership write invalidates every
  // page with the one call.
  memberPage: (projectKey: string, params: unknown) =>
    ['members', projectKey, 'page', params] as const,
  // Every project's member list, for a write that changes what any of them resolves
  // to (a role edited on the team they belong to).
  anyMembers: ['members'] as const,
  invites: (projectKey: string) => ['invites', projectKey] as const,
  anyInvites: ['invites'] as const,
  // Who a project can be filled from: the members of its team who are not in it yet.
  memberCandidates: (projectKey: string) => ['members', projectKey, 'candidates'] as const,
  // The invites of a team, including the ones into its projects.
  teamInvites: (teamId: number) => ['teamInvites', teamId] as const,
  anyTeamInvites: ['teamInvites'] as const,
  // The roles a team offers, which is what every project of it assigns from. The
  // permission catalog is app-static, so it is scoped to no team.
  teamRoles: (teamId: number) => ['teamRoles', teamId] as const,
  roleUsage: (teamId: number, roleId: number) => ['roleUsage', teamId, roleId] as const,
  anyRoleUsage: ['roleUsage'] as const,
  permissionCatalog: ['permissionCatalog'] as const,
  // A team's AI agents (its Agents section), and the ones working in one of its
  // projects (the project's read-only list). The action catalog is team-scoped on the
  // API, so it hangs off the same key with a 'tools' tail.
  aiAgents: (teamId: number, projectId?: number) =>
    ['aiAgents', teamId, projectId ?? 'all'] as const,
  anyAiAgents: ['aiAgents'] as const,
  teamAiAgents: (teamId: number) => ['aiAgents', teamId] as const,
  agentTools: (teamId: number) => ['aiAgents', teamId, 'tools'] as const,
  // The skills enabled on one agent (the agent editor's Skills tab).
  agentSkillLinks: (teamId: number, agentId: number) =>
    ['aiAgents', teamId, agentId, 'skills'] as const,
  // An agent's triggered run history (the runs sidebar).
  agentRuns: (teamId: number, agentId: number) => ['aiAgents', teamId, agentId, 'runs'] as const,
  agentSchedules: (projectKey: string) => ['agentSchedules', projectKey] as const,
  // One page of them: the window scopes the entry.
  agentSchedulePage: (projectKey: string, params: unknown) =>
    ['agentSchedules', projectKey, 'page', params] as const,
  agentScheduleRuns: (projectKey: string, scheduleId: number) =>
    ['agentSchedules', projectKey, scheduleId, 'runs'] as const,
  // The caller's chat threads with one agent (the AI Chat history rail) and the
  // transcript of one thread (restored when a thread is opened). A search is a list of
  // its own, so the unsearched list stays cached while one is typed.
  agentThreadLists: (projectKey: string, agentId: number) =>
    ['aiAgents', projectKey, agentId, 'threadList'] as const,
  agentThreads: (projectKey: string, agentId: number, q = '') =>
    ['aiAgents', projectKey, agentId, 'threadList', q] as const,
  // The conversations starred with one agent: the group on top of the history, and what
  // the star in the tabs bar reads its state from.
  agentFavoriteThreads: (projectKey: string, agentId: number) =>
    ['aiAgents', projectKey, agentId, 'favoriteThreads'] as const,
  agentThreadMessages: (projectKey: string, agentId: number, threadId: string) =>
    ['aiAgents', projectKey, agentId, 'threads', threadId] as const,
  // Everything integration-scoped. A credential belongs to the team, so changing one
  // is invalidated at this prefix: the pickers its projects fill from go stale too.
  integrations: ['integrations'] as const,
  // One page of the team's stored credentials (its Integrations tab); the window
  // scopes the entry. The integration catalog and an LLM provider's models sit beside
  // it, under the same team prefix.
  teamCredentialPage: (teamId: number, params: unknown) =>
    ['integrations', 'team', teamId, 'page', params] as const,
  integrationCatalog: (teamId: number) => ['integrations', 'team', teamId, 'catalog'] as const,
  integrationModels: (teamId: number, provider: string) =>
    ['integrations', 'team', teamId, 'models', provider] as const,
  // The connected integrations as picker options, under the same prefix so a
  // credential mutation refreshes them too.
  integrationOptions: (teamId: number, kind?: string) =>
    ['integrations', 'team', teamId, 'options', kind ?? 'all'] as const,
  // Everything skill-scoped in one team. A write invalidates at this prefix, so the
  // page the section shows, the whole library the picker reads and the skill the
  // editor has open all refresh together.
  agentSkills: (teamId: number) => ['agentSkills', teamId] as const,
  agentSkillPage: (teamId: number, params: unknown) =>
    ['agentSkills', teamId, 'page', params] as const,
  agentSkillOptions: (teamId: number) => ['agentSkills', teamId, 'options'] as const,
  agentSkill: (teamId: number, skillId: number) =>
    ['agentSkills', teamId, 'skill', skillId] as const,
  // The team's configured tools (its Tools section) and the tools enabled on one agent
  // (the agent editor's Tools section).
  configuredTools: (teamId: number) => ['configuredTools', teamId] as const,
  configuredToolPage: (teamId: number, params: unknown) =>
    ['configuredTools', teamId, 'page', params] as const,
  configuredToolOptions: (teamId: number) => ['configuredTools', teamId, 'options'] as const,
  agentToolLinks: (teamId: number, agentId: number) =>
    ['aiAgents', teamId, agentId, 'tool-configs'] as const,
  issue: (id: number) => ['issue', id] as const,
  // Under the issue prefix, so every issue mutation refreshes the cycles with it.
  issueCycles: (id: number) => ['issue', id, 'cycles'] as const,
  anyIssue: ['issue'] as const,
  // Resolving an issue by its project-scoped number (the identifier-based URL).
  issueBySeq: (projectKey: string, seq: number) => ['issueBySeq', projectKey, seq] as const,
  feed: (id: number) => ['feed', id] as const,
  // The same feed split by status, paged on its own.
  groupedFeed: (id: number) => ['feed', id, 'grouped'] as const,
  // The status stretches of the timeline view, and the entries of one stretch read
  // when it is opened. Both keyed under the feed, so every existing feed
  // invalidation refreshes them too.
  timeline: (id: number) => ['feed', id, 'timeline'] as const,
  timelineItems: (id: number, from: string, to: string | null) =>
    ['feed', id, 'timelineItems', from, to] as const,
  // Initiatives: a project's list (params narrow, sort and page it), the per-status
  // tab counts, one initiative, and one initiative's activity feed.
  initiatives: (projectKey: string, params: unknown) =>
    ['initiatives', projectKey, params] as const,
  initiativesForProject: (projectKey: string) => ['initiatives', projectKey] as const,
  // The linkable initiatives behind the issue picker, narrowed by the typed search.
  initiativeOptions: (projectKey: string, params: Record<string, unknown>) =>
    ['initiatives', projectKey, 'options', params] as const,
  initiativeCounts: (projectKey: string) => ['initiativeCounts', projectKey] as const,
  initiative: (id: number) => ['initiative', id] as const,
  initiativeFeed: (id: number) => ['initiativeFeed', id] as const,
  // Prefix keys: issue mutations invalidate every initiative query without
  // knowing the id (see invalidateInitiatives in issues.service).
  anyInitiative: ['initiative'] as const,
  anyInitiativeFeed: ['initiativeFeed'] as const,
  anyInitiatives: ['initiatives'] as const,
  // Cycles: a project's list and one cycle. Issue mutations invalidate the whole
  // 'cycles' subtree, since planning an issue moves a cycle's progress. The list the
  // page reads is split in two — what is still planned, and the paged archive —
  // under the same prefix, so one invalidation covers all three.
  cycles: (projectKey: string) => ['cycles', projectKey] as const,
  plannedCycles: (projectKey: string) => ['cycles', projectKey, 'planned'] as const,
  cycleOptions: (projectKey: string) => ['cycles', projectKey, 'options'] as const,
  completedCycles: (projectKey: string) => ['cycles', projectKey, 'completed'] as const,
  cycle: (id: number) => ['cycle', id] as const,
  anyCycles: ['cycles'] as const,
  anyCycle: ['cycle'] as const,
  attachments: (id: number) => ['attachments', id] as const,
  // The time entries of one issue. Their sum comes with the issue, so a write
  // refreshes that read too.
  worklogs: (id: number) => ['worklogs', id] as const,
  // A project's inbox notifications (the list, scoped by the active filters) and the
  // project's unread count (the sidebar badge + live-refresh target).
  notifications: (projectKey: string, filters?: unknown) =>
    ['notifications', projectKey, filters ?? {}] as const,
  notificationsUnread: (projectKey: string) => ['notificationsUnread', projectKey] as const,
  // The signed-in user's WebAuthn passkeys (account security page).
  passkeys: ['passkeys'] as const,
  // The signed-in user's connected external accounts (accounts page): the linked
  // Telegram account, and the auth providers better-auth reports.
  telegramAccount: ['telegramAccount'] as const,
  linkedAccounts: ['linkedAccounts'] as const,
  // The instance sign-in policy, including which social providers are configured.
  authConfig: ['authConfig'] as const,
  // The signed-in user's personal API keys (API keys page).
  apiKeys: ['apiKeys'] as const,
  // The signed-in user's interface preferences (timezone, theme, issue open mode,
  // start page). Read app-wide, not just on the preferences page.
  accountPreferences: ['accountPreferences'] as const,
  // Instance administration (god mode): the sign-in policy, the mail provider, the
  // sign-in providers, SCIM provisioning and the Telegram bot. Not scoped to a project.
  instanceAuthSettings: ['instanceAuthSettings'] as const,
  instanceEmailSettings: ['instanceEmailSettings'] as const,
  instanceGoogleSettings: ['instanceGoogleSettings'] as const,
  instanceOidcSettings: ['instanceOidcSettings'] as const,
  instanceScimSettings: ['instanceScimSettings'] as const,
  instanceScimGroups: ['instanceScimGroups'] as const,
  instanceTelegramSettings: ['instanceTelegramSettings'] as const,
  instanceProjectDefaults: ['instanceProjectDefaults'] as const,
  instanceStorageSettings: ['instanceStorageSettings'] as const,
  // The upload limits as read by the upload UI (open to any signed-in user).
  storageSettings: ['storageSettings'] as const,
  // The running version (any signed-in user) and the upstream release check (god).
  appVersion: ['appVersion'] as const,
  // The post-upgrade screen: the running release's notes, the backup and the
  // migration report.
  whatsNew: ['whatsNew'] as const,
  updateStatus: ['updateStatus'] as const,
  // The bindings every client resolves from, and the god-mode editor's copy.
  hotkeySettings: ['hotkeySettings'] as const,
  instanceHotkeySettings: ['hotkeySettings', 'god'] as const,
  // The instance user directory: the list (scoped by the active filters) and one
  // account with its project access.
  instanceUsers: (filters: unknown) => ['instanceUsers', filters] as const,
  instanceUser: (userId: string) => ['instanceUser', userId] as const,
  anyInstanceUsers: ['instanceUsers'] as const,
  // The instance project directory: the list (scoped by the active filters) and one
  // project with its members.
  instanceProjects: (filters: unknown) => ['instanceProjects', filters] as const,
  instanceProjectOptions: ['instanceProjectOptions'] as const,
  instanceProject: (projectId: number) => ['instanceProject', projectId] as const,
};
