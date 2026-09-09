import { request } from '@/lib/api/core/client';

// One release. The ones above the running version come from the repository's feed
// and carry HTML notes; the ones up to it come from this build's changelog and
// carry markdown.
export interface Release {
  tag: string;
  version: string;
  publishedAt: string;
  url: string | null;
  notes: string;
  notesFormat: 'html' | 'markdown';
}

// How the running version compares to what is published. `latestVersion` and
// `checkedAt` are null until an upstream check has succeeded.
export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  checkedAt: string | null;
  releases: Release[];
}

// The screen shown once after an upgrade. `backup` and `migration` are filled for
// the instance owner and a team owner only — they name projects, roles and agents
// across the instance — and are null for everyone else.
export interface BackupInfo {
  path: string;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string;
  migrations: string[];
}

// What the move to teams did to this instance's data, as the migration recorded it.
export interface TeamsMigrationReport {
  version: number;
  teams: { name: string; projects: { key: string; name: string }[] }[];
  // Keyed by what was renamed: roles, skills, agents, credentials.
  renamed: Record<string, { from: string; to: string }[]>;
  merged: { roles: number; agentTools: number };
  movedInvites: number;
  droppedNotificationSettings: string[];
}

export interface WhatsNew {
  version: string;
  pending: boolean;
  // Every release this user has not seen yet, newest first.
  releases: Release[];
  backup: BackupInfo | null;
  migration: TeamsMigrationReport | null;
}

// The running version, shown in the sidebar to every signed-in user.
export const getAppVersion = () => request<{ version: string }>('/settings/version');

// The release this instance just upgraded to, and what the upgrade did to its
// data. Read once per session; closing the screen records the version.
export const getWhatsNew = () => request<WhatsNew>('/settings/whats-new');

export const markWhatsNewSeen = () =>
  request<{ version: string }>('/settings/whats-new/seen', { method: 'POST' });

// Whether a newer release exists, and the release notes behind it. God mode: the
// instance owner is the one who upgrades.
export const getUpdateStatus = () => request<UpdateStatus>('/god/updates');

export const checkForUpdates = () =>
  request<UpdateStatus>('/god/updates/check', { method: 'POST' });
