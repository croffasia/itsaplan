import type { CanonicalStateCategory } from './canonical';
import { LinearReader, type LinearCredential } from './linear-adapter';
import { PlaneReader, type PlaneCredential } from './plane-adapter';
import { TrelloReader, type TrelloCredential } from './trello-adapter';
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

export interface TrelloImportConfig extends CommonImportConfig {
  boardId: string;
  archivedCards: 'archive' | 'skip';
  // Trello member id -> the email of the project member the user matched it with.
  memberEmails?: Record<string, string>;
}

export interface ImportSourceDefinition<Credential, Config> {
  buildReader(credential: Credential, config: Partial<Config>, jobId: number): SourceReader;
  // The prefix of the source's own issue identifiers ("ROOMS" in "ROOMS-524").
  projectKey(config: Partial<Config>): string | null;
}

type StoredSourceDefinition = ImportSourceDefinition<unknown, unknown>;

// One entry per import_job.source. A build adds its own sources before the worker starts.
const IMPORT_SOURCES = new Map<string, StoredSourceDefinition>();

export function registerImportSource<Credential, Config>(
  source: string,
  definition: ImportSourceDefinition<Credential, Config>,
): void {
  if (IMPORT_SOURCES.has(source)) {
    throw new Error(`import source "${source}" is already registered`);
  }
  IMPORT_SOURCES.set(source, definition as unknown as StoredSourceDefinition);
}

registerImportSource<PlaneCredential, PlaneImportConfig>('plane', {
  buildReader(credential, config, jobId) {
    if (!config.planeProjectId) {
      throw new Error(`import job ${jobId} has no source project configured`);
    }
    return new PlaneReader(credential, config.planeProjectId);
  },
  projectKey: (config) => config.planeProjectKey ?? null,
});

registerImportSource<LinearCredential, LinearImportConfig>('linear', {
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
});

registerImportSource<TrelloCredential, TrelloImportConfig>('trello', {
  buildReader(credential, config, jobId) {
    const keys = credential && typeof credential === 'object' ? Object.keys(credential) : [];
    const isTrello =
      keys.length === 2 &&
      typeof credential.apiKey === 'string' &&
      credential.apiKey !== '' &&
      typeof credential.token === 'string' &&
      credential.token !== '';
    if (!isTrello) {
      throw new Error(`import job ${jobId} has a credential that is not a Trello key and token`);
    }
    const { boardId, archivedCards } = config;
    if (!boardId || (archivedCards !== 'archive' && archivedCards !== 'skip')) {
      throw new Error(`import job ${jobId} has no source board configured`);
    }
    return new TrelloReader(credential, {
      boardId,
      archivedCards,
      memberEmails: config.memberEmails ?? {},
    });
  },
  // A Trello card has no key-style identifier; another card is referred to by its URL.
  projectKey: () => null,
});

export interface ImportJobSource {
  id: number;
  source: string;
  config: Record<string, unknown>;
}

function definitionOf(job: ImportJobSource): StoredSourceDefinition {
  const definition = IMPORT_SOURCES.get(job.source);
  if (!definition) throw new UnsupportedImportSourceError(job.id, job.source);
  return definition;
}

export function readerForJob(job: ImportJobSource, credential: unknown): SourceReader {
  return definitionOf(job).buildReader(credential, job.config, job.id);
}

export function sourceProjectKeyForJob(job: ImportJobSource): string | null {
  return definitionOf(job).projectKey(job.config);
}
