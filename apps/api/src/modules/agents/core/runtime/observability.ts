import { Mastra } from '@mastra/core';
import { MastraStorageExporter, Observability } from '@mastra/observability';
import { getStore } from './store';

// Tracing of internal agent runs. Mastra emits a span for the run and one for every
// model call and tool call inside it, but only through a Mastra container: an agent
// built on its own writes nothing. So every agent a run builds is registered with the
// single container held here, which carries the exporter that writes the spans into
// the store (Mastra's own `mastra_ai_spans` table, on the application database).
//
// A run names what it belongs to in the trace metadata (see prepareRun in index.ts),
// which is what the trace list filters on — spans carry no foreign keys of ours.
//
// Nothing else of the container is used: the agents are built per run from their
// stored configuration, so none is registered as a named agent of it.

let mastra: Mastra | null = null;

export function getMastra(): Mastra {
  if (!mastra) {
    mastra = new Mastra({
      storage: getStore(),
      observability: new Observability({
        configs: {
          default: {
            serviceName: 'itsaplan-agents',
            exporters: [new MastraStorageExporter()],
          },
        },
      }),
    });
  }
  return mastra;
}
