import { Elysia, t } from 'elysia';
import { authContext } from '../shared/auth-context';
import { assertPermission } from '../shared/access';
import { getProjectById } from '../projects/store';
import {
  closeSession,
  getServerCredential,
  getServerProjectId,
  markConnected,
  openSession,
  pinHostKey,
} from './store';
import { SESSION_MAX_MS, openShell, type SshFailure } from './ssh';

// What a browser terminal is told. The reasons are a fixed set: the underlying
// ssh2 message can name the host, the key type and the account, so it stays in
// the session record and never crosses to the client.
const FAILURE_TEXT: Record<SshFailure, string> = {
  host_key_changed:
    'The host key of this server changed. Nothing was sent. Verify the machine, then re-pin it from the server settings.',
  auth_failed: 'The stored credential was refused by this server.',
  unreachable: 'Could not reach this server.',
  timeout: 'The server did not answer in time.',
  shell_failed: 'Connected, but the server refused to open a shell.',
};

const MAX_INPUT_BYTES = 8 * 1024;

interface TerminalState {
  sessionId: number;
  end: () => void;
  bytesIn: number;
  bytesOut: number;
  closed: boolean;
  timer: ReturnType<typeof setTimeout>;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
}

const sessions = new WeakMap<object, TerminalState>();

function send(ws: { send: (data: string) => void }, payload: Record<string, unknown>): void {
  ws.send(JSON.stringify(payload));
}

// The terminal socket. Authentication rides on the upgrade request, which is a
// normal GET: without a session authContext rejects it and the socket never
// opens. The permission is then checked against the project that owns the server,
// so a member without `servers` access cannot reach a shell.
export const serverTerminalRoutes = new Elysia({ name: 'server-terminal' })
  .use(authContext)
  .ws('/servers/:serverId/terminal', {
    params: t.Object({ serverId: t.Numeric() }),
    query: t.Object({
      cols: t.Optional(t.Numeric({ minimum: 20, maximum: 500 })),
      rows: t.Optional(t.Numeric({ minimum: 5, maximum: 200 })),
    }),

    async open(ws) {
      const { params, query, user } = ws.data;
      const serverId = params.serverId;

      const projectId = await getServerProjectId(serverId);
      if (projectId == null) {
        send(ws, { type: 'error', message: 'Server not found' });
        ws.close();
        return;
      }
      try {
        await assertPermission(projectId, user, 'servers', 'edit');
        const project = await getProjectById(projectId);
        if (!project) throw new Error('missing project');
      } catch {
        send(ws, { type: 'error', message: 'You do not have terminal access to this server' });
        ws.close();
        return;
      }

      const credential = await getServerCredential(serverId);
      if (!credential || !credential.active) {
        send(ws, { type: 'error', message: 'This server is not available' });
        ws.close();
        return;
      }

      // Recorded before the connection is attempted, so a refused credential or a
      // changed host key leaves a trace too.
      const sessionId = await openSession({ projectId, serverId, userId: user?.id ?? null });

      const result = await openShell(credential, {
        cols: query.cols ?? 80,
        rows: query.rows ?? 24,
      });

      if (!result.ok) {
        await closeSession(sessionId, {
          status: 'failed',
          errorCode: result.failure,
          bytesIn: 0,
          bytesOut: 0,
        });
        send(ws, { type: 'error', message: FAILURE_TEXT[result.failure] });
        ws.close();
        return;
      }

      if (!credential.hostKeyFingerprint && result.fingerprint) {
        await pinHostKey(serverId, result.fingerprint);
        send(ws, { type: 'pinned', fingerprint: result.fingerprint });
      }
      await markConnected(serverId);

      const { channel, end } = result.handles;
      const state: TerminalState = {
        sessionId,
        end,
        bytesIn: 0,
        bytesOut: 0,
        closed: false,
        timer: setTimeout(() => {
          send(ws, { type: 'error', message: 'Session reached its time limit.' });
          ws.close();
        }, SESSION_MAX_MS),
        write: (data: string) => channel.write(data),
        resize: (cols: number, rows: number) => channel.setWindow(rows, cols, 0, 0),
      };
      sessions.set(ws.raw as object, state);

      channel.on('data', (chunk: Buffer) => {
        state.bytesOut += chunk.length;
        send(ws, { type: 'data', data: chunk.toString('base64') });
      });
      channel.stderr?.on('data', (chunk: Buffer) => {
        state.bytesOut += chunk.length;
        send(ws, { type: 'data', data: chunk.toString('base64') });
      });
      channel.on('close', () => {
        send(ws, { type: 'closed' });
        ws.close();
      });

      send(ws, { type: 'ready' });
    },

    message(ws, message) {
      const state = sessions.get(ws.raw as object);
      if (!state || state.closed) return;
      const payload = message as { type?: string; data?: string; cols?: number; rows?: number };

      if (payload.type === 'input' && typeof payload.data === 'string') {
        const data = Buffer.from(payload.data, 'base64');
        if (data.length > MAX_INPUT_BYTES) return;
        state.bytesIn += data.length;
        state.write(data.toString('utf8'));
        return;
      }
      if (payload.type === 'resize' && payload.cols && payload.rows) {
        const cols = Math.min(500, Math.max(20, Math.floor(payload.cols)));
        const rows = Math.min(200, Math.max(5, Math.floor(payload.rows)));
        state.resize(cols, rows);
      }
    },

    async close(ws) {
      const state = sessions.get(ws.raw as object);
      if (!state || state.closed) return;
      state.closed = true;
      clearTimeout(state.timer);
      state.end();
      await closeSession(state.sessionId, {
        status: 'closed',
        bytesIn: state.bytesIn,
        bytesOut: state.bytesOut,
      });
    },
  });
