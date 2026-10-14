// Whether an internal agent may do a piece of work at all, asked of an extension of the
// api before the work reaches the model: in the poller before a queued run starts, and
// in prepareRun before a chat answer. A reason refuses it: the queued run fails with the
// reason and is not retried, the chat answers with it. A self-hosted instance refuses
// nothing. An external agent works on its own machine and is never asked about.

export interface InternalWork {
  agentId: number;
  teamId: number;
  projectId: number;
  // Who asked for the work: the member of a chat, or the author of the comment that
  // mentioned the agent. Null for work nobody asked for in person, such as a delegation
  // or a schedule's run.
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
