import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';
import type { ChatMessage, Run } from './client';
import type { Log } from './tasks';

// The runner as the endpoint an agent's tasks are sent to: one HTTP server per port, for
// every agent configured on it. A request is the instance's only when it is signed with one
// of those agents' secrets, and the secret it is signed with is also what says which agent
// it is for. TLS is left to the tunnel or the reverse proxy in front of the port.
//
// The answer goes out as soon as the task is queued: it only tells the instance that the
// runner took the task. The task then runs and reports exactly as a claimed one does.

// How far a request's timestamp may be from the clock here, so that a captured request
// cannot be sent again later.
const SIGNATURE_TOLERANCE_S = 300;
// A task is a prompt and its context; a body far larger than that is not one.
const MAX_BODY_BYTES = 5 * 1024 * 1024;

// The header is `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">`.
export function verifySignature(
  secret: string,
  header: string,
  body: string,
  nowSeconds = Date.now() / 1000,
): boolean {
  const fields = new Map(
    header.split(',').map((part) => {
      const at = part.indexOf('=');
      return [part.slice(0, at).trim(), part.slice(at + 1).trim()] as const;
    }),
  );
  const t = fields.get('t');
  const v1 = fields.get('v1');
  if (!t || !v1 || !Number.isFinite(Number(t))) return false;
  if (Math.abs(nowSeconds - Number(t)) > SIGNATURE_TOLERANCE_S) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  // Bytes, not characters: a header of non-ASCII characters is longer in bytes, and
  // timingSafeEqual throws on buffers of different lengths.
  const given = Buffer.from(v1);
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export interface ListenAgent {
  secret: string;
  // Tasks at once, per feed, the same as for a polled agent.
  concurrency: number;
  run: (run: Run) => Promise<void>;
  chat: (message: ChatMessage) => Promise<void>;
}

export interface Listener {
  port: number;
  // Stops taking requests and resolves once the tasks already taken are finished.
  close: () => Promise<void>;
}

// One feed of one agent: at most `limit` tasks at a time, the rest in the order they came.
// The instance sends a task again when its lease runs out, so a task already held here is
// not started a second time.
function feed<T extends { id: number }>(
  limit: number,
  work: (item: T) => Promise<void>,
  inFlight: Set<Promise<void>>,
): (item: T) => void {
  let active = 0;
  const waiting: (() => void)[] = [];
  const held = new Set<number>();
  const acquire = () => {
    if (active < limit) {
      active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => waiting.push(resolve));
  };
  // A waiting task takes the slot over, so a request that arrives meanwhile cannot take it
  // as well.
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else active--;
  };
  return (item) => {
    if (held.has(item.id)) return;
    held.add(item.id);
    const task = acquire()
      .then(() => work(item))
      .finally(() => {
        held.delete(item.id);
        release();
      });
    inFlight.add(task);
    void task.finally(() => inFlight.delete(task)).catch(() => {});
  };
}

class TooLargeError extends Error {}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new TooLargeError());
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

interface Payload {
  event?: string;
  run?: Run;
  message?: ChatMessage;
}

export function startListener(port: number, agents: ListenAgent[], log: Log): Promise<Listener> {
  const inFlight = new Set<Promise<void>>();
  const served = agents.map((agent) => ({
    secret: agent.secret,
    run: feed(agent.concurrency, agent.run, inFlight),
    chat: feed(agent.concurrency, agent.chat, inFlight),
  }));

  // Every path is answered the same way, so a proxy that adds a prefix needs no setting.
  const server = createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405, { allow: 'POST' }).end();
      return;
    }
    readBody(req).then(
      (body) => {
        const header = req.headers['x-itsaplan-signature'];
        const agent =
          typeof header === 'string'
            ? served.find((candidate) => verifySignature(candidate.secret, header, body))
            : undefined;
        if (!agent) {
          log('refused a request that no configured agent signed');
          res.writeHead(401).end('bad signature');
          return;
        }
        let payload: Payload;
        try {
          payload = JSON.parse(body) as Payload;
        } catch {
          res.writeHead(400).end('body is not JSON');
          return;
        }
        if (payload.event === 'agent.run' && payload.run) agent.run(payload.run);
        else if (payload.event === 'agent.chat' && payload.message) agent.chat(payload.message);
        else if (payload.event !== 'ping') {
          res.writeHead(400).end(`unknown event ${String(payload.event)}`);
          return;
        }
        res.writeHead(200).end('ok');
      },
      (err: unknown) => {
        res.writeHead(err instanceof TooLargeError ? 413 : 400).end();
      },
    );
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.off('error', reject);
      const address = server.address();
      resolve({
        port: typeof address === 'object' && address ? address.port : port,
        close: async () => {
          await new Promise<void>((done) => {
            server.close(() => done());
            server.closeIdleConnections();
          });
          await Promise.allSettled([...inFlight]);
        },
      });
    });
  });
}
