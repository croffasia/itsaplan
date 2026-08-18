import { Elysia } from 'elysia';
import { requireUser } from '#shared/access';
import { authContext } from '#shared/auth-context';
import { HttpError } from '#shared/lib';
import { errors } from '#shared/responses';
import { getMembership } from '#modules/members/service';
import { PreferencePatch, PreferenceResponse } from './model';
import { getPreferences, isValidTimezone, updatePreferences } from './service';
import { localeFromAcceptLanguage } from './locale';

// The session user's own interface preferences: timezone, language, theme, how a clicked issue
// opens, which section the app root lands on, whether the floating AI chat starts
// visible, how an issue's status stats section starts out, whether they are
// subscribed to the issues they touch, and the project they were in last. Every
// route is self-scoped to the session user, so no project guard applies — a user
// only ever reads or writes their own row. Not MCP tools: an agent has no business
// changing a person's UI settings.
export const userPreferenceRoutes = new Elysia({
  name: 'user-preferences',
  detail: { tags: ['Settings'] },
})
  .use(authContext)

  .get(
    '/account/preferences',
    ({ user, request }) =>
      getPreferences(
        requireUser(user).id,
        localeFromAcceptLanguage(request.headers.get('accept-language')),
      ),
    {
      response: { 200: PreferenceResponse, ...errors(401) },
      detail: {
        summary: 'Get account preferences',
        description:
          "Get the current user's interface preferences. Returns browser-localized defaults when none were saved.",
      },
    },
  )

  .patch(
    '/account/preferences',
    async ({ user, body, request }) => {
      const current = requireUser(user);
      if (body.timezone !== undefined && !isValidTimezone(body.timezone)) {
        throw new HttpError(400, 'Unknown timezone');
      }
      // Only a project the user belongs to can be remembered, so the stored id can
      // never point at one they cannot open.
      if (body.lastProjectId != null && !(await getMembership(body.lastProjectId, current.id))) {
        throw new HttpError(403, 'You do not have access to this project');
      }
      return updatePreferences(
        current.id,
        body,
        localeFromAcceptLanguage(request.headers.get('accept-language')),
      );
    },
    {
      body: PreferencePatch,
      response: { 200: PreferenceResponse, ...errors(400, 401, 403) },
      detail: {
        summary: 'Update account preferences',
        description:
          "Update the current user's interface preferences. Omitted fields keep their current value.",
      },
    },
  );
