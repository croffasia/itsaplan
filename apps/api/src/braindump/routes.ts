import { Elysia, t } from 'elysia';
import { guards, entityGuard } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { noContent } from '../shared/http';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { mcpTool } from '../mcp/generate';
import { getObject, deleteObject } from '../shared/s3';
import { uploadObjectKey, storeUploadedObject, assertProjectQuota } from '../shared/uploads';
import { getProjectById } from '../projects/store';
import { listColumns } from '../columns/store';
import { createIssue } from '../issues/store';
import { createAgentSchedule } from '../agent-schedules/store';
import { nextCronRun } from '../agent-schedules/cron';
import {
  createBraindumpEntry,
  deleteBraindumpEntry,
  getBraindumpAudioKey,
  getBraindumpEntry,
  getBraindumpEntryProjectId,
  getBraindumpStats,
  listBraindumpEntries,
  markBraindumpRouted,
  updateBraindumpEntry,
} from './store';
import { createMindFact } from '../mind/store';
import { assertAudioAllowed, transcribeAudio, whisperConfigured } from './whisper';
import { obsidianConfigured, renderNote, writeNote } from './obsidian';
import { deriveTitle } from './title';

const projectParams = t.Object({ projectKey: t.String() });
const entryParams = t.Object({ entryId: t.Numeric() });

const KindSchema = t.Union([
  t.Literal('idea'),
  t.Literal('task'),
  t.Literal('note'),
  t.Literal('voice'),
]);
const DestinationSchema = t.Union([
  t.Literal('obsidian'),
  t.Literal('issue'),
  t.Literal('schedule'),
]);

const EntryResponse = t.Object({
  id: t.Number(),
  kind: KindSchema,
  title: t.String(),
  body: t.String(),
  tags: t.Array(t.String()),
  pinned: t.Boolean(),
  authorName: t.Nullable(t.String()),
  hasAudio: t.Boolean(),
  audioDurationSec: t.Nullable(t.Number()),
  routedTo: t.Nullable(DestinationSchema),
  routedAt: t.Nullable(t.String()),
  routedRef: t.Nullable(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
});

const StatsResponse = t.Object({
  routedToday: t.Number(),
  unsorted: t.Number(),
  byDestination: t.Array(t.Object({ destination: t.String(), count: t.Number() })),
  daily: t.Array(t.Object({ date: t.String(), count: t.Number() })),
  total: t.Number(),
  averagePerDay: t.Number(),
});

// What the capture UI needs to know before it offers voice or a destination: both
// depend on instance configuration, not on the project or the user's permissions.
const ConfigResponse = t.Object({ voice: t.Boolean(), obsidian: t.Boolean() });

const TAGS_MAX = 12;
const TagsSchema = t.Array(t.String({ minLength: 1, maxLength: 40 }), { maxItems: TAGS_MAX });

// Every capture also lands in the memory, which is what makes Mind the one place
// the operation reads from. It arrives as an unverified daily note: the thought is
// recorded, but nothing acts on it as settled until the operator files it under a
// real category and verifies it.
async function rememberCapture(
  projectId: number,
  authorUserId: string | null,
  entry: { id: number; title: string; body: string; tags: string[] },
): Promise<void> {
  await createMindFact({
    projectId,
    authorUserId,
    braindumpEntryId: entry.id,
    category: 'daily_notes',
    title: entry.title,
    body: entry.body,
    tags: entry.tags,
    source: 'braindump',
    confidence: 40,
  });
}

export const braindumpRoutes = new Elysia({ name: 'braindump', detail: { tags: ['Braindump'] } })
  .use(authContext)
  .use(guards)
  .macro({
    braindumpEntry: entityGuard('braindump', 'Dump not found', (p) =>
      getBraindumpEntryProjectId(Number(p.entryId)),
    ),
  })

  .get(
    '/projects/:projectKey/braindump/config',
    () => ({ voice: whisperConfigured(), obsidian: obsidianConfigured() }),
    {
      params: projectParams,
      permission: ['braindump', 'read'],
      response: { 200: ConfigResponse, 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse },
      detail: { summary: 'Braindump capture configuration' },
    },
  )

  .get(
    '/projects/:projectKey/braindump/stats',
    ({ project, query }) => getBraindumpStats(project.id, query.days ?? 14),
    {
      params: projectParams,
      query: t.Object({ days: t.Optional(t.Numeric({ minimum: 1, maximum: 90 })) }),
      permission: ['braindump', 'read'],
      response: { 200: StatsResponse, 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse },
      detail: { summary: 'Braindump capture statistics', ...mcpTool('braindump_stats') },
    },
  )

  .get(
    '/projects/:projectKey/braindump',
    ({ project, query }) =>
      listBraindumpEntries(project.id, {
        kind: query.kind,
        tag: query.tag,
        search: query.search,
        days: query.days,
      }),
    {
      params: projectParams,
      query: t.Object({
        kind: t.Optional(KindSchema),
        tag: t.Optional(t.String({ maxLength: 40 })),
        search: t.Optional(t.String({ maxLength: 200 })),
        days: t.Optional(t.Numeric({ minimum: 1, maximum: 365 })),
      }),
      permission: ['braindump', 'read'],
      response: {
        200: t.Array(EntryResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'List braindump entries', ...mcpTool('list_braindump_entries') },
    },
  )

  .post(
    '/projects/:projectKey/braindump',
    async ({ project, body, user, set }) => {
      const text = body.body.trim();
      if (text.length === 0) throw new HttpError(400, 'A dump needs some text');
      const row = await createBraindumpEntry({
        projectId: project.id,
        authorUserId: user?.id ?? null,
        kind: body.kind,
        title: body.title?.trim() || deriveTitle(text),
        body: text,
        tags: body.tags ?? [],
      });
      await rememberCapture(project.id, user?.id ?? null, row);
      set.status = 201;
      return row;
    },
    {
      params: projectParams,
      body: t.Object({
        kind: KindSchema,
        title: t.Optional(t.String({ maxLength: 200 })),
        body: t.String({ minLength: 1, maxLength: 20_000 }),
        tags: t.Optional(TagsSchema),
      }),
      permission: ['braindump', 'create'],
      response: {
        201: EntryResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Capture a braindump entry', ...mcpTool('create_braindump_entry') },
    },
  )

  // Transcribes an uploaded recording and stores it as a voice dump. The audio is
  // kept in the object store so the card can play back what was said; the
  // transcript is the entry body.
  .post(
    '/projects/:projectKey/braindump/voice',
    async ({ project, body, user, set }) => {
      const file = body.file;
      if (!(file instanceof File))
        throw new HttpError(400, 'No audio uploaded (form field "file")');
      const contentType = file.type || 'application/octet-stream';
      assertAudioAllowed(file.size, contentType);
      await assertProjectQuota(project.id, file.size);

      const transcript = await transcribeAudio(file, file.name || 'dump.webm');
      if (transcript.length === 0) throw new HttpError(422, 'Nothing was recognised in the audio');

      const key = uploadObjectKey(project.id, 'braindump', file.name || 'dump.webm');
      await storeUploadedObject(key, Buffer.from(await file.arrayBuffer()), contentType);

      const row = await createBraindumpEntry({
        projectId: project.id,
        authorUserId: user?.id ?? null,
        kind: 'voice',
        title: deriveTitle(transcript),
        body: transcript,
        tags: [],
        audioS3Key: key,
        audioDurationSec: body.durationSec ? Number(body.durationSec) : null,
        audioSizeBytes: file.size,
      });
      await rememberCapture(project.id, user?.id ?? null, row);
      set.status = 201;
      return row;
    },
    {
      params: projectParams,
      body: t.Object({ file: t.File(), durationSec: t.Optional(t.String()) }),
      permission: ['braindump', 'create'],
      response: {
        201: EntryResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        413: ErrorResponse,
        415: ErrorResponse,
        422: ErrorResponse,
        502: ErrorResponse,
        503: ErrorResponse,
      },
      detail: { summary: 'Capture a voice dump' },
    },
  )

  .patch(
    '/braindump/:entryId',
    async ({ params, body }) => {
      const row = await updateBraindumpEntry(params.entryId, {
        ...(body.title != null ? { title: body.title.trim() } : {}),
        ...(body.body != null ? { body: body.body.trim() } : {}),
        ...(body.tags != null ? { tags: body.tags } : {}),
        ...(body.kind != null ? { kind: body.kind } : {}),
        ...(body.pinned != null ? { pinned: body.pinned } : {}),
      });
      if (!row) throw new HttpError(404, 'Dump not found');
      return row;
    },
    {
      params: entryParams,
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        body: t.Optional(t.String({ maxLength: 20_000 })),
        tags: t.Optional(TagsSchema),
        kind: t.Optional(KindSchema),
        pinned: t.Optional(t.Boolean()),
      }),
      braindumpEntry: 'edit',
      response: {
        200: EntryResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Update a braindump entry' },
    },
  )

  .delete(
    '/braindump/:entryId',
    async ({ params }) => {
      const key = await getBraindumpAudioKey(params.entryId);
      await deleteBraindumpEntry(params.entryId);
      // Best-effort, like every other object-store delete: a failure only orphans
      // bytes and must not fail the request.
      if (key) {
        await deleteObject(key).catch((err) => {
          console.error(`[planner] failed to delete braindump audio ${key}:`, err);
        });
      }
      return noContent();
    },
    {
      params: entryParams,
      braindumpEntry: 'delete',
      response: { 204: t.Void(), 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse },
      detail: { summary: 'Delete a braindump entry' },
    },
  )

  .get(
    '/braindump/:entryId/audio',
    async ({ params }) => {
      const key = await getBraindumpAudioKey(params.entryId);
      if (!key) throw new HttpError(404, 'This dump has no audio');
      let obj;
      try {
        obj = await getObject(key);
      } catch {
        throw new HttpError(404, 'Audio not found');
      }
      // The stored bytes were accepted against an audio allowlist on upload, but
      // the response still forbids sniffing and never renders as a document.
      const headers: Record<string, string> = {
        'Content-Type': obj.contentType,
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=3600',
      };
      if (obj.contentLength != null) headers['Content-Length'] = String(obj.contentLength);
      return new Response(obj.body, { headers });
    },
    {
      params: entryParams,
      braindumpEntry: 'read',
      detail: { summary: 'Stream a voice dump recording' },
    },
  )

  // Files a dump to one of the three destinations and records where it landed.
  // Obsidian writes a note, `issue` opens a work item on the board, `schedule`
  // hands the text to an agent on a cron.
  .post(
    '/braindump/:entryId/route',
    async ({ params, body, projectId, user }) => {
      const entry = await getBraindumpEntry(params.entryId);
      if (!entry) throw new HttpError(404, 'Dump not found');

      let ref: string;
      if (body.destination === 'obsidian') {
        const markdown = renderNote({
          title: entry.title,
          body: entry.body,
          kind: entry.kind,
          tags: entry.tags,
          createdAt: entry.createdAt,
          author: entry.authorName,
        });
        ref = await writeNote(entry.id, markdown, entry.title);
      } else if (body.destination === 'issue') {
        const project = await getProjectById(projectId);
        if (!project) throw new HttpError(404, 'Project not found');
        const columns = await listColumns(projectId);
        const columnId = body.columnId ?? columns[0]?.id;
        if (columnId == null) throw new HttpError(400, 'The project has no workflow column');
        const issue = await createIssue(
          project,
          { columnId, title: entry.title, description: entry.body },
          user?.id ?? null,
        );
        ref = `${project.key}-${issue.sequenceNumber}`;
      } else {
        if (!body.agentId) throw new HttpError(400, 'agentId is required to schedule a dump');
        if (!body.cron) throw new HttpError(400, 'cron is required to schedule a dump');
        const nextRunAt = nextCronRun(body.cron);
        const schedule = await createAgentSchedule({
          projectId,
          agentId: body.agentId,
          name: entry.title.slice(0, 80),
          prompt: entry.body,
          cron: body.cron,
          status: 'active',
          nextRunAt,
        });
        if (!schedule) throw new HttpError(404, 'Agent not found');
        ref = String(schedule.id);
      }

      const row = await markBraindumpRouted(entry.id, body.destination, ref);
      if (!row) throw new HttpError(404, 'Dump not found');
      return row;
    },
    {
      params: entryParams,
      body: t.Object({
        destination: DestinationSchema,
        columnId: t.Optional(t.Number()),
        agentId: t.Optional(t.Number()),
        cron: t.Optional(t.String({ maxLength: 120 })),
      }),
      braindumpEntry: 'edit',
      response: {
        200: EntryResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        502: ErrorResponse,
        503: ErrorResponse,
      },
      detail: { summary: 'File a braindump entry to a destination' },
    },
  );
