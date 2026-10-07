import type { CanonicalStateCategory } from './canonical';
import { LinearReader, type LinearCredential } from './linear-adapter';
import { PlaneReader, type PlaneCredential } from './plane-adapter';
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

// One entry per import_job.source. A new source adds a member to both maps and an
// entry to IMPORT_SOURCES.
export interface ImportCredentials {
  plane: PlaneCredential;
  linear: LinearCredential;
}

export interface ImportConfigs {
  plane: PlaneImportConfig;
  linear: LinearImportConfig;
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
