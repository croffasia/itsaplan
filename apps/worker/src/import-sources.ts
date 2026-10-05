import type { CanonicalStateCategory } from './canonical';
import { PlaneReader, type PlaneCredential } from './plane-adapter';
import type { SourceReader } from './reader';

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

// One entry per import_job.source. A new source adds a member to both maps and an
// entry to IMPORT_SOURCES.
export interface ImportCredentials {
  plane: PlaneCredential;
}

export interface ImportConfigs {
  plane: PlaneImportConfig;
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
};

export interface ImportJobSource {
  id: number;
  source: string;
  config: Record<string, unknown>;
}

function sourceOf(job: ImportJobSource): ImportSourceKind {
  if (!Object.hasOwn(IMPORT_SOURCES, job.source)) {
    throw new Error(`import job ${job.id} has unsupported source "${job.source}"`);
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
