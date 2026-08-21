import { createHmac, timingSafeEqual } from 'node:crypto';

// The provider adapters behind the one inbound webhook receiver. An adapter
// recognises a delivery by its headers, verifies it with the credential its
// platform sends, and normalizes it to a PullRequestEvent. The handler then reads
// one shape for every platform.

// A pull request delivery in provider-neutral form. `defaultBranch` is null when
// the payload does not carry it, which turns off the merged-into-default-branch
// check for that delivery.
export interface PullRequestEvent {
  action: 'opened' | 'merged';
  number: number;
  title: string;
  body: string;
  url: string | null;
  repo: string;
  targetBranch: string;
  defaultBranch: string | null;
  draft: boolean;
}

export type DeliveryHeaders = Record<string, string | undefined>;

export interface GitProvider {
  // The actor of the activity entry the delivery creates. Gitea and Forgejo share
  // an adapter, so the name comes from the headers rather than a fixed string.
  label(headers: DeliveryHeaders): string;
  matches(headers: DeliveryHeaders): boolean;
  verify(secret: string, rawBody: string, headers: DeliveryHeaders): boolean;
  deliveryId(headers: DeliveryHeaders): string | undefined;
  // The repository the delivery came from, recorded as telemetry for any event.
  repo(payload: unknown): string | undefined;
  parse(payload: unknown, headers: DeliveryHeaders): PullRequestEvent | null;
}

// An HMAC-SHA256 hex digest of the raw body, with or without the "sha256=" prefix
// the platform may put in front of it.
function hmacValid(secret: string, rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const hex = signature.startsWith('sha256=') ? signature.slice('sha256='.length) : signature;
  const given = Buffer.from(hex, 'hex');
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// A shared token sent as-is, which is how GitLab authenticates a delivery.
function tokenValid(secret: string, token: string | undefined): boolean {
  if (token == null) return false;
  const given = Buffer.from(token);
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// The pull request URL is rendered as a link in the activity feed. Only http(s)
// passes, so a crafted delivery cannot plant a javascript: href; anything else
// becomes null and the entry carries no link.
function httpUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}

// The slice of a GitHub pull_request payload the adapters read. Gitea and Forgejo
// send the same shape.
interface GithubPayload {
  action?: string;
  pull_request?: {
    number?: number;
    title?: string;
    body?: string | null;
    html_url?: string;
    merged?: boolean;
    draft?: boolean;
    base?: { ref?: string };
  };
  repository?: { full_name?: string; default_branch?: string };
}

function githubRepo(payload: unknown): string | undefined {
  return (payload as GithubPayload).repository?.full_name;
}

function parseGithubPayload(payload: unknown): PullRequestEvent | null {
  const { action, pull_request: pr, repository } = payload as GithubPayload;
  if (!pr?.number || !repository?.full_name) return null;
  const merged = action === 'closed' && pr.merged === true;
  // A pull request opened as a draft is ignored until it is marked ready, which
  // GitHub reports as its own action. Gitea and Forgejo never send it: their draft
  // is a title prefix, so leaving it is an ordinary edit with nothing to key on.
  if (action !== 'opened' && action !== 'ready_for_review' && !merged) return null;
  return {
    action: merged ? 'merged' : 'opened',
    number: pr.number,
    title: pr.title ?? '',
    body: pr.body ?? '',
    url: httpUrl(pr.html_url),
    repo: repository.full_name,
    targetBranch: pr.base?.ref ?? '',
    defaultBranch: repository.default_branch ?? null,
    draft: pr.draft === true,
  };
}

const github: GitProvider = {
  label: () => 'GitHub',
  matches: (h) => h['x-github-event'] != null,
  verify: (secret, body, h) => hmacValid(secret, body, h['x-hub-signature-256']),
  deliveryId: (h) => h['x-github-delivery'],
  repo: githubRepo,
  parse: parseGithubPayload,
};

// Gitea and Forgejo send GitHub-shaped payloads under their own headers, plus
// GitHub's for compatibility — so this is matched before the GitHub adapter. Both
// repeat the same digest under every signature header they know, and a Forgejo
// delivery carries X-Gitea-Event too, so either header can be the one that arrives.
const gitea: GitProvider = {
  label: (h) => (h['x-forgejo-event'] != null ? 'Forgejo' : 'Gitea'),
  matches: (h) => h['x-gitea-event'] != null || h['x-forgejo-event'] != null,
  verify: (secret, body, h) =>
    hmacValid(
      secret,
      body,
      h['x-forgejo-signature'] ?? h['x-gitea-signature'] ?? h['x-hub-signature-256'],
    ),
  deliveryId: (h) => h['x-forgejo-delivery'] ?? h['x-gitea-delivery'],
  repo: githubRepo,
  parse: parseGithubPayload,
};

interface GitlabPayload {
  object_kind?: string;
  object_attributes?: {
    iid?: number;
    title?: string;
    description?: string | null;
    url?: string;
    action?: string;
    target_branch?: string;
    draft?: boolean;
    work_in_progress?: boolean;
  };
  project?: { path_with_namespace?: string; default_branch?: string };
  changes?: { draft?: { previous?: boolean; current?: boolean } };
}

const gitlab: GitProvider = {
  label: () => 'GitLab',
  matches: (h) => h['x-gitlab-event'] != null,
  // GitLab sends the secret token as-is instead of signing the body.
  verify: (secret, _body, h) => tokenValid(secret, h['x-gitlab-token']),
  // Idempotency-Key is the id GitLab keeps stable across retries. X-Gitlab-Event-UUID
  // is only a fallback for versions that predate it: events one webhook triggers in
  // turn share its value, so it cannot identify a delivery on its own.
  deliveryId: (h) => h['idempotency-key'] ?? h['x-gitlab-event-uuid'],
  repo: (payload) => (payload as GitlabPayload).project?.path_with_namespace,
  parse: (payload) => {
    const { object_kind: kind, object_attributes: mr, project, changes } = payload as GitlabPayload;
    if (kind !== 'merge_request' || !mr?.iid || !project?.path_with_namespace) return null;
    // Marking a draft merge request ready is one of the many edits GitLab reports
    // as "update"; only the changes diff says which one it was.
    const readied =
      mr.action === 'update' &&
      changes?.draft?.previous === true &&
      changes.draft.current === false;
    if (mr.action !== 'open' && mr.action !== 'merge' && !readied) return null;
    return {
      action: mr.action === 'merge' ? 'merged' : 'opened',
      number: mr.iid,
      title: mr.title ?? '',
      body: mr.description ?? '',
      url: httpUrl(mr.url),
      repo: project.path_with_namespace,
      targetBranch: mr.target_branch ?? '',
      defaultBranch: project.default_branch ?? null,
      draft: mr.draft === true || mr.work_in_progress === true,
    };
  },
};

interface BitbucketPayload {
  pullrequest?: {
    id?: number;
    title?: string;
    description?: string | null;
    draft?: boolean;
    destination?: { branch?: { name?: string } };
    links?: { html?: { href?: string } };
  };
  repository?: { full_name?: string; mainbranch?: { name?: string } };
}

const bitbucket: GitProvider = {
  label: () => 'Bitbucket',
  matches: (h) => h['x-event-key'] != null,
  // Bitbucket signs the body with the webhook secret and sends the digest as
  // "sha256=<hex>" in X-Hub-Signature.
  verify: (secret, body, h) => hmacValid(secret, body, h['x-hub-signature']),
  deliveryId: (h) => h['x-request-uuid'] ?? h['x-request-id'],
  repo: (payload) => (payload as BitbucketPayload).repository?.full_name,
  parse: (payload, headers) => {
    const key = headers['x-event-key'];
    if (key !== 'pullrequest:created' && key !== 'pullrequest:fulfilled') return null;
    const { pullrequest: pr, repository } = payload as BitbucketPayload;
    if (!pr?.id || !repository?.full_name) return null;
    return {
      action: key === 'pullrequest:fulfilled' ? 'merged' : 'opened',
      number: pr.id,
      title: pr.title ?? '',
      body: pr.description ?? '',
      url: httpUrl(pr.links?.html?.href),
      repo: repository.full_name,
      targetBranch: pr.destination?.branch?.name ?? '',
      // Not part of the documented repository entity, so it is usually absent and
      // the merged-into-default-branch check is off for Bitbucket.
      defaultBranch: repository.mainbranch?.name ?? null,
      draft: pr.draft === true,
    };
  },
};

const PROVIDERS: GitProvider[] = [gitea, gitlab, bitbucket, github];

export function detectProvider(headers: DeliveryHeaders): GitProvider | null {
  return PROVIDERS.find((p) => p.matches(headers)) ?? null;
}
