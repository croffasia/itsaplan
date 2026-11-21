import type { RunnerQueueActor } from '@/lib/api/endpoints/runnerQueue';
import RunnerQueueRunPerson from './RunnerQueueRunPerson';

export default function RunnerQueueRunActor({ actor }: { actor: RunnerQueueActor }) {
  const { name, image, agentUsername } = actor;
  return agentUsername ? (
    <RunnerQueueRunPerson name={agentUsername} label={`@${agentUsername}`} />
  ) : (
    <RunnerQueueRunPerson name={name} image={image} label={name} />
  );
}
