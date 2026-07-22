import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// The agent tools with no route behind them. Everything an agent does to a project
// goes through the real API (see route-tools.ts); this is what is left over.
//
// The current date is not a project resource, so exposing it over REST would add an
// endpoint that exists only for the agent. It is answered in process instead.

export function buildLocalTools(): Record<string, ReturnType<typeof createTool>> {
  return {
    get_current_date: createTool({
      id: 'get_current_date',
      description:
        'Get the current date and time (UTC, ISO 8601). Always call this to resolve any relative date such as today, tomorrow, next week, or a due date; never assume or guess the current date.',
      inputSchema: z.object({}),
      execute: async () => {
        const now = new Date();
        return { iso: now.toISOString(), date: now.toISOString().slice(0, 10) };
      },
    }),
  };
}
