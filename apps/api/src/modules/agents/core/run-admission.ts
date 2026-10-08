import type { AgentRunTrigger } from '../model';

// Whether a claimed run starts now, asked of an extension of the api before the run
// reaches its agent: in the poller for an internal agent, in the runner's claim for an
// external one. A self-hosted instance starts every run.

export interface RunForAdmission {
  id: number;
  agentId: number;
  projectId: number;
  issueId: number | null;
  scheduleId: number | null;
  trigger: AgentRunTrigger;
}

// Seconds the run waits before it is claimed again; 0 starts it. The wait does not
// spend an attempt (deferRun).
type RunAdmission = (run: RunForAdmission) => Promise<number>;

const startNow: RunAdmission = async () => 0;

let admission = startNow;

export function setRunAdmission(next = startNow): void {
  admission = next;
}

export function runAdmissionDelay(run: RunForAdmission): Promise<number> {
  return admission(run);
}
