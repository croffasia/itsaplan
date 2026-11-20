// Whether an internal agent may do a piece of work at all, asked of an extension of the
// api before the work reaches the model: in the poller before a queued run starts, in
// prepareRun before a chat answer, and when an API task is queued. A reason refuses it:
// the queued run fails with the reason and is not retried, the chat and the API answer
// with it. A self-hosted instance refuses nothing. An external agent works on its own
// machine and is never asked about.

export interface InternalWork {
  agentId: number;
  teamId: number;
  projectId: number;
  // The person the work is for: the member of a chat or the person a queued run is for.
  // Null for the project's own work, such as a schedule's run.
  userId: string | null;
}

type RunRefusal = (work: InternalWork) => Promise<string | null>;

const refuseNothing: RunRefusal = async () => null;

let refusal = refuseNothing;

export function setRunRefusal(next = refuseNothing): void {
  refusal = next;
}

export function runRefusal(work: InternalWork): Promise<string | null> {
  return refusal(work);
}
