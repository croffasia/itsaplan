import { Elysia } from 'elysia';
import { requireUser } from '#shared/access';
import { authContext } from '#shared/auth-context';
import { HttpError } from '#shared/lib';
import { getRunnerAgent } from './runner/service';

// Resolves the agent from the caller's API key, so a runner can only ever reach its own
// work. Used by both feeds it drains — the run queue and the chat. Set
// `runnerAgent: true` in the route options and read `agent` in the handler.
export const runnerAuth = new Elysia({ name: 'runner-auth' }).use(authContext).macro({
  runnerAgent(_enabled: boolean) {
    return {
      async resolve({ user }) {
        const agent = await getRunnerAgent(requireUser(user).id);
        if (!agent) throw new HttpError(403, 'Only an agent key can drain an agent feed');
        if (agent.kind !== 'external') throw new HttpError(403, 'Internal agents run in-process');
        return { agent };
      },
    };
  },
});
