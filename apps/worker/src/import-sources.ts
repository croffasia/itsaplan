import type { CanonicalStateCategory } from './canonical';
import { LinearReader, type LinearCredential } from './linear-adapter';
import { PlaneReader, type PlaneCredential } from './plane-adapter';
import { JiraReader, type JiraCredential } from './jira-adapter';
import { TrelloReader, type TrelloCredential } from './trello-adapter';
import { ProcoreReader, type ProcoreCredential } from './procore-adapter';
import { MsProjectReader } from './msproject-adapter';
import type { ProcoreTool } from './procore-mapping';
import { UnsupportedImportSourceError, type SourceReader } from './reader';

// The import_job.config fields every source shares; the phases read them directly.
export interface CommonImportConfig {
  unmatchedUserPolicy?: 'unassigned' | 'skip';
  stateOverrides?: Record<string, CanonicalStateCategory>;
}

export interface PlaneImportConfig extends CommonImportConfig {
  planeProjectId: string;
  // Absent on a job created before the Rewrite phase existed; Rewrite then leaves text as written.
  planeProjectKey?: string;
}

export interface LinearImportConfig extends CommonImportConfig {
  teamId: string;
  // The team's issue-key prefix ("ATO" in "ATO-505") for Rewrite.
  teamKey: string;
  // One job imports one project of the team, or the team's issues with no project.
  projectFilter: 'project' | 'none';
  projectId: string | null;
}

export interface JiraImportConfig extends CommonImportConfig {
  // The project key ("OPS" in "OPS-12"): the JQL scope and the Rewrite prefix.
  jiraProjectKey: string;
}

// Trello cards have no "KEY-123" identifier, so Rewrite leaves their text as written.
export interface TrelloImportConfig extends CommonImportConfig {
  trelloBoardId: string;
}

// Procore items have no "KEY-123" identifier, so Rewrite leaves their text as written.
export interface ProcoreImportConfig extends CommonImportConfig {
  procoreProjectId: string;
  procoreTool: ProcoreTool;
}

// The uploaded MSPDI file's object key. Tasks have no "KEY-123" identifier either.
export interface MsProjectImportConfig extends CommonImportConfig {
  msprojectFileKey: string;
  msprojectName?: string;
}

// An MS Project job reads an uploaded file and needs no credential; the api stores an
// empty object because the pipeline requires one.
export type MsProjectCredential = Record<string, never>;

// One entry per import_job.source. A new source adds a member to both maps and an
// entry to IMPORT_SOURCES.
export interface ImportCredentials {
  plane: PlaneCredential;
  linear: LinearCredential;
  jira: JiraCredential;
  trello: TrelloCredential;
  procore: ProcoreCredential;
  msproject: MsProjectCredential;
}

export interface ImportConfigs {
  plane: PlaneImportConfig;
  linear: LinearImportConfig;
  jira: JiraImportConfig;
  trello: TrelloImportConfig;
  procore: ProcoreImportConfig;
  msproject: MsProjectImportConfig;
}

export type ImportSourceKind = keyof ImportConfigs;
export type ImportCredential = ImportCredentials[ImportSourceKind];
export type ImportConfig = ImportConfigs[ImportSourceKind];

interface ImportSourceDefinition<S extends ImportSourceKind> {
  buildReader(
    credential: ImportCredentials[S],
    config: Partial<ImportConfigs[S]>,
    jobId: number,
  ): SourceReader;
  // The prefix of the source's own issue identifiers ("ROOMS" in "ROOMS-524").
  projectKey(config: Partial<ImportConfigs[S]>): string | null;
}

const IMPORT_SOURCES: { [S in ImportSourceKind]: ImportSourceDefinition<S> } = {
  plane: {
    buildReader(credential, config, jobId) {
      if (!config.planeProjectId) {
        throw new Error(`import job ${jobId} has no source project configured`);
      }
      return new PlaneReader(credential, config.planeProjectId);
    },
    projectKey: (config) => config.planeProjectKey ?? null,
  },
  linear: {
    buildReader(credential, config, jobId) {
      // The registry types do not tie a decrypted credential to its job's source.
      // Exactly { apiKey }: a Plane credential also has an apiKey, plus baseUrl and workspaceSlug.
      const keys = credential && typeof credential === 'object' ? Object.keys(credential) : [];
      if (keys.length !== 1 || typeof credential.apiKey !== 'string' || credential.apiKey === '') {
        throw new Error(`import job ${jobId} has a credential that is not a Linear API key`);
      }
      const { teamId, projectFilter, projectId } = config;
      if (!teamId || !(projectFilter === 'none' || (projectFilter === 'project' && projectId))) {
        throw new Error(`import job ${jobId} has no source project configured`);
      }
      return new LinearReader(credential, {
        teamId,
        projectFilter,
        projectId: projectFilter === 'project' ? (projectId ?? null) : null,
      });
    },
    projectKey: (config) => config.teamKey ?? null,
  },
  jira: {
    buildReader(credential, config, jobId) {
      if (typeof credential?.email !== 'string' || typeof credential.apiToken !== 'string') {
        throw new Error(`import job ${jobId} has a credential that is not a Jira API token`);
      }
      if (!config.jiraProjectKey) {
        throw new Error(`import job ${jobId} has no source project configured`);
      }
      return new JiraReader(credential, config.jiraProjectKey);
    },
    projectKey: (config) => config.jiraProjectKey ?? null,
  },
  trello: {
    buildReader(credential, config, jobId) {
      if (typeof credential?.apiKey !== 'string' || typeof credential.token !== 'string') {
        throw new Error(`import job ${jobId} has a credential that is not a Trello key and token`);
      }
      if (!config.trelloBoardId) {
        throw new Error(`import job ${jobId} has no source project configured`);
      }
      return new TrelloReader(credential, config.trelloBoardId);
    },
    projectKey: () => null,
  },
  procore: {
    buildReader(credential, config, jobId) {
      if (
        typeof credential?.clientId !== 'string' ||
        typeof credential.clientSecret !== 'string' ||
        typeof credential.companyId !== 'string'
      ) {
        throw new Error(
          `import job ${jobId} has a credential that is not a Procore service account`,
        );
      }
      if (
        !config.procoreProjectId ||
        (config.procoreTool !== 'punch_items' && config.procoreTool !== 'rfis')
      ) {
        throw new Error(`import job ${jobId} has no source project configured`);
      }
      return new ProcoreReader(credential, config.procoreProjectId, config.procoreTool);
    },
    projectKey: () => null,
  },
  msproject: {
    buildReader(_credential, config, jobId) {
      if (!config.msprojectFileKey) {
        throw new Error(`import job ${jobId} has no uploaded file configured`);
      }
      return new MsProjectReader(config.msprojectFileKey);
    },
    projectKey: () => null,
  },
};

export interface ImportJobSource {
  id: number;
  source: string;
  config: Record<string, unknown>;
}

function sourceOf(job: ImportJobSource): ImportSourceKind {
  if (!Object.hasOwn(IMPORT_SOURCES, job.source)) {
    throw new UnsupportedImportSourceError(job.id, job.source);
  }
  return job.source as ImportSourceKind;
}

function definitionOf<S extends ImportSourceKind>(source: S): ImportSourceDefinition<S> {
  return IMPORT_SOURCES[source];
}

export function readerForJob(job: ImportJobSource, credential: ImportCredential): SourceReader {
  return definitionOf(sourceOf(job)).buildReader(
    credential,
    job.config as Partial<ImportConfig>,
    job.id,
  );
}

export function sourceProjectKeyForJob(job: ImportJobSource): string | null {
  return definitionOf(sourceOf(job)).projectKey(job.config as Partial<ImportConfig>);
}
