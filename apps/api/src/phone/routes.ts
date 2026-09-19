import { Elysia, t } from 'elysia';
import { authContext } from '../shared/auth-context';
import { guards } from '../shared/guards';
import { noContent } from '../shared/http';
import { ErrorResponse } from '../shared/responses';
import {
  rinkelConfigured,
  rinkelGet,
  rinkelSend,
  type RinkelCall,
  type RinkelCount,
  type RinkelNumber,
  type RinkelNumberDetail,
  type RinkelPage,
  type RinkelStreamUrl,
  type RinkelTranscription,
  type RinkelUser,
} from './client';
import { callDto, callStats, numberDto } from './presenters';
import { crmPhoneIndex, listCallEvents } from './store';

const projectParams = t.Object({ projectKey: t.String() });
const streamParams = t.Object({ projectKey: t.String(), id: t.String() });

const CallResponse = t.Object({
  id: t.String(),
  callId: t.String(),
  date: t.String(),
  direction: t.String(),
  status: t.String(),
  missedReason: t.Nullable(t.String()),
  duration: t.Number(),
  externalNumber: t.Nullable(t.String()),
  anonymous: t.Boolean(),
  blocked: t.Boolean(),
  internalNumber: t.Nullable(t.String()),
  internalLabel: t.Nullable(t.String()),
  contactName: t.Nullable(t.String()),
  userName: t.Nullable(t.String()),
  recordingId: t.Nullable(t.String()),
  voicemailId: t.Nullable(t.String()),
  voicemailNew: t.Boolean(),
  hasNotes: t.Boolean(),
  sentiment: t.Nullable(t.String()),
  summary: t.Nullable(t.String()),
  crmCustomerId: t.Nullable(t.String()),
  crmCustomerName: t.Nullable(t.String()),
});

const PaginationResponse = t.Object({
  totalItems: t.Number(),
  totalPages: t.Number(),
  currentPage: t.Number(),
  perPage: t.Number(),
});

const CallsResponse = t.Object({
  calls: t.Array(CallResponse),
  pagination: PaginationResponse,
  stats: t.Object({
    total: t.Number(),
    inbound: t.Number(),
    answered: t.Number(),
    missed: t.Number(),
    voicemail: t.Number(),
    averageDuration: t.Number(),
  }),
});

const OverviewResponse = t.Object({
  // False when RINKEL_KEY is missing, so the page can explain itself instead of
  // showing an error.
  configured: t.Boolean(),
  numbers: t.Array(
    t.Object({
      id: t.String(),
      label: t.Nullable(t.String()),
      number: t.String(),
      status: t.String(),
    }),
  ),
  newVoicemails: t.Number(),
});

const DirectionSchema = t.Union([t.Literal('inbound'), t.Literal('outbound')]);
const StatusSchema = t.Union([
  t.Literal('MISSED'),
  t.Literal('ANSWERED'),
  t.Literal('VOICEMAIL'),
  t.Literal('ANSWERING_SERVICE'),
]);

const CallEventResponse = t.Object({
  id: t.Number(),
  event: t.String(),
  callId: t.Nullable(t.String()),
  direction: t.Nullable(t.String()),
  externalNumber: t.Nullable(t.String()),
  internalNumber: t.Nullable(t.String()),
  receivedAt: t.String(),
});

const DEFAULT_PER_PAGE = 25;

// The business number: its call history, its voicemails and the recordings behind
// them. Everything is read from Rinkel on request; nothing is mirrored locally.
export const phoneRoutes = new Elysia({ name: 'phone', detail: { tags: ['Phone'] } })
  .use(authContext)
  .use(guards)

  .get(
    '/projects/:projectKey/phone/overview',
    async () => {
      if (!rinkelConfigured()) return { configured: false, numbers: [], newVoicemails: 0 };

      const [numbers, voicemails] = await Promise.all([
        rinkelGet<RinkelPage<RinkelNumber>>('/numbers'),
        rinkelGet<RinkelCount>('/voicemails/new-count').catch(() => ({ data: { count: 0 } })),
      ]);
      return {
        configured: true,
        numbers: (numbers.data ?? []).map(numberDto),
        newVoicemails: voicemails.data?.count ?? 0,
      };
    },
    {
      params: projectParams,
      permission: ['phone', 'read'],
      response: {
        200: OverviewResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        502: ErrorResponse,
        503: ErrorResponse,
      },
      detail: { summary: 'The business numbers and the unheard voicemail count' },
    },
  )

  .get(
    '/projects/:projectKey/phone/calls',
    async ({ query, project }) => {
      const page = await rinkelGet<RinkelPage<RinkelCall>>('/call-detail-records', {
        page: query.page ?? 1,
        perPage: query.perPage ?? DEFAULT_PER_PAGE,
        direction: query.direction,
        status: query.status,
        filter: query.search,
        internalNumber: query.numberId,
        sortOrder: 'DESC',
        contactLookup: true,
      });

      const crmIndex = await crmPhoneIndex(project.id);
      const calls = (page.data ?? []).map((call) => callDto(call, crmIndex));
      const pagination = page.meta?.pagination;
      return {
        calls,
        pagination: {
          totalItems: pagination?.totalItems ?? calls.length,
          totalPages: pagination?.totalPages ?? 1,
          currentPage: pagination?.currentPage ?? 1,
          perPage: pagination?.perPage ?? DEFAULT_PER_PAGE,
        },
        stats: callStats(calls),
      };
    },
    {
      params: projectParams,
      permission: ['phone', 'read'],
      query: t.Object({
        page: t.Optional(t.Numeric({ minimum: 1 })),
        perPage: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
        direction: t.Optional(DirectionSchema),
        status: t.Optional(StatusSchema),
        search: t.Optional(t.String({ maxLength: 80 })),
        numberId: t.Optional(t.String({ maxLength: 60 })),
      }),
      response: {
        200: CallsResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        502: ErrorResponse,
        503: ErrorResponse,
      },
      detail: { summary: 'The call history of the business numbers' },
    },
  )

  // Rinkel's own audio urls need the API key, which the browser must never see.
  // These two hand back the short-lived url Rinkel issues instead.
  .get(
    '/projects/:projectKey/phone/recordings/:id/stream',
    ({ params }) =>
      rinkelGet<RinkelStreamUrl>(`/call-recordings/${encodeURIComponent(params.id)}/stream`),
    {
      params: streamParams,
      permission: ['phone', 'read'],
      response: {
        200: t.Object({ data: t.Object({ url: t.String() }) }),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        502: ErrorResponse,
        503: ErrorResponse,
      },
      detail: { summary: 'A temporary url to play a call recording' },
    },
  )

  .get(
    '/projects/:projectKey/phone/voicemails/:id/stream',
    ({ params }) =>
      rinkelGet<RinkelStreamUrl>(`/voicemails/${encodeURIComponent(params.id)}/stream`),
    {
      params: streamParams,
      permission: ['phone', 'read'],
      response: {
        200: t.Object({ data: t.Object({ url: t.String() }) }),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        502: ErrorResponse,
        503: ErrorResponse,
      },
      detail: { summary: 'A temporary url to play a voicemail' },
    },
  )

  // Call recording is a dial-plan setting of the number. With it off the call
  // history carries no audio at all, so the page offers the switch directly.
  .get(
    '/projects/:projectKey/phone/numbers/:id/recording',
    async ({ params }) => {
      const detail = await rinkelGet<RinkelNumberDetail>(
        `/numbers/${encodeURIComponent(params.id)}`,
      );
      return {
        enabled: detail.data.dialPlan?.callRecording?.enabled ?? false,
        insightsEnabled: detail.data.insights?.enabled ?? false,
      };
    },
    {
      params: streamParams,
      permission: ['phone', 'read'],
      response: {
        200: t.Object({ enabled: t.Boolean(), insightsEnabled: t.Boolean() }),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        502: ErrorResponse,
        503: ErrorResponse,
      },
      detail: { summary: 'Whether a number records its calls' },
    },
  )

  .put(
    '/projects/:projectKey/phone/numbers/:id/recording',
    async ({ params, body }) => {
      await rinkelSend(
        'PUT',
        `/numbers/${encodeURIComponent(params.id)}/dial-plan/v1/call-recording`,
        { enabled: body.enabled },
      );
      return noContent();
    },
    {
      params: streamParams,
      permission: ['phone', 'edit'],
      body: t.Object({ enabled: t.Boolean() }),
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        502: ErrorResponse,
        503: ErrorResponse,
      },
      detail: { summary: 'Turn call recording on or off for a number' },
    },
  )

  .put(
    '/projects/:projectKey/phone/calls/:id/note',
    async ({ params, body }) => {
      await rinkelSend('PUT', `/call-detail-records/${encodeURIComponent(params.id)}/note`, {
        content: body.content,
      });
      return noContent();
    },
    {
      params: streamParams,
      permission: ['phone', 'edit'],
      body: t.Object({ content: t.String({ minLength: 1, maxLength: 2000 }) }),
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        502: ErrorResponse,
        503: ErrorResponse,
      },
      detail: { summary: 'Add a note to a call' },
    },
  )

  .delete(
    '/projects/:projectKey/phone/calls/:id/note/:noteId',
    async ({ params }) => {
      const noteId = encodeURIComponent(params.noteId);
      await rinkelSend(
        'DELETE',
        `/call-detail-records/${encodeURIComponent(params.id)}/note/${noteId}`,
      );
      return noContent();
    },
    {
      params: t.Object({ projectKey: t.String(), id: t.String(), noteId: t.String() }),
      permission: ['phone', 'edit'],
      response: {
        204: t.Void(),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        502: ErrorResponse,
        503: ErrorResponse,
      },
      detail: { summary: 'Remove a note from a call' },
    },
  )

  // Rinkel keys the transcription by callId, not by the record id.
  .get(
    '/projects/:projectKey/phone/calls/:id/transcription',
    async ({ params }) => {
      const result = await rinkelGet<RinkelTranscription>(
        `/call-detail-records/by-call-id/${encodeURIComponent(params.id)}/transcription`,
      );
      return { transcription: result.data.transcription ?? '' };
    },
    {
      params: streamParams,
      permission: ['phone', 'read'],
      response: {
        200: t.Object({ transcription: t.String() }),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        502: ErrorResponse,
        503: ErrorResponse,
      },
      detail: { summary: 'The transcription of a call, by its call id' },
    },
  )

  .post(
    '/projects/:projectKey/phone/block',
    async ({ body }) => {
      await rinkelSend('POST', '/privacy/block-number', {
        number: body.number,
        reason: body.reason ?? '',
      });
      return noContent();
    },
    {
      params: projectParams,
      permission: ['phone', 'edit'],
      body: t.Object({
        number: t.String({ minLength: 3, maxLength: 32 }),
        reason: t.Optional(t.String({ maxLength: 200 })),
      }),
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        502: ErrorResponse,
        503: ErrorResponse,
      },
      detail: { summary: 'Block a caller' },
    },
  )

  .delete(
    '/projects/:projectKey/phone/block',
    async ({ body }) => {
      await rinkelSend('DELETE', '/privacy/unblock-number', { number: body.number });
      return noContent();
    },
    {
      params: projectParams,
      permission: ['phone', 'edit'],
      body: t.Object({ number: t.String({ minLength: 3, maxLength: 32 }) }),
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        502: ErrorResponse,
        503: ErrorResponse,
      },
      detail: { summary: 'Unblock a caller' },
    },
  )

  // Click to dial: Rinkel rings the registered device first and connects it to the
  // destination once it is answered. It is not a phone in the browser, and it needs
  // a device on the Rinkel account, which is what this list reports.
  .get(
    '/projects/:projectKey/phone/devices',
    async () => {
      const users = await rinkelGet<RinkelPage<RinkelUser>>('/users');
      return (users.data ?? [])
        .filter((user): user is RinkelUser & { deviceId: string } => Boolean(user.deviceId))
        .map((user) => ({ deviceId: user.deviceId, name: user.fullName }));
    },
    {
      params: projectParams,
      permission: ['phone', 'read'],
      response: {
        200: t.Array(t.Object({ deviceId: t.String(), name: t.String() })),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        502: ErrorResponse,
        503: ErrorResponse,
      },
      detail: { summary: 'The devices a call can be started from' },
    },
  )

  .post(
    '/projects/:projectKey/phone/dial',
    async ({ body }) => {
      await rinkelSend('POST', '/dial', {
        deviceId: body.deviceId,
        to: body.to,
        numberId: body.numberId,
        anonymous: body.anonymous ?? false,
      });
      return noContent();
    },
    {
      params: projectParams,
      permission: ['phone', 'edit'],
      body: t.Object({
        deviceId: t.String({ minLength: 1, maxLength: 60 }),
        to: t.String({ minLength: 3, maxLength: 32 }),
        numberId: t.String({ minLength: 1, maxLength: 60 }),
        anonymous: t.Optional(t.Boolean()),
      }),
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        502: ErrorResponse,
        503: ErrorResponse,
      },
      detail: { summary: 'Start a call from a registered device' },
    },
  )

  .get('/projects/:projectKey/phone/events', ({ query }) => listCallEvents(query.since ?? 0), {
    params: projectParams,
    permission: ['phone', 'read'],
    query: t.Object({ since: t.Optional(t.Numeric({ minimum: 0 })) }),
    response: {
      200: t.Array(CallEventResponse),
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
    detail: { summary: 'Call events Rinkel pushed since a given id' },
  });
