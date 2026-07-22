import { HttpError } from '../shared/lib';

// Parsing and validation for skills in the Anthropic Agent Skill format: a SKILL.md
// with YAML frontmatter (name/description) plus optional reference files, no
// executable scripts. Kept dependency-free — only the two frontmatter keys are read,
// so a minimal parser is enough and there is no YAML dependency to pull in.

export interface SkillFrontmatter {
  name?: string;
  description?: string;
}

// Reads name/description from a leading `---` frontmatter block. Tolerant: missing
// frontmatter yields an empty result, and only these two keys are recognized. A
// value may be a plain/quoted scalar or a YAML block scalar (`|`/`>` with an
// optional `+`/`-` chomping indicator) spanning the following indented lines; since
// name and description are short labels, a block is collapsed into a single line.
export function parseFrontmatter(markdown: string): SkillFrontmatter {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!match) return {};
  const lines = match[1].split(/\r?\n/);
  const out: SkillFrontmatter = {};

  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    if (key !== 'name' && key !== 'description') continue;
    let value = kv[2].trim();

    if (/^[|>][+-]?$/.test(value)) {
      // Block scalar: gather the following lines that are indented under the key,
      // relative to the first content line, and collapse to one line.
      const body: string[] = [];
      let indent = -1;
      let j = i + 1;
      for (; j < lines.length; j++) {
        const line = lines[j];
        if (line.trim() === '') {
          body.push('');
          continue;
        }
        const lead = line.length - line.trimStart().length;
        if (indent === -1) indent = lead;
        if (lead < indent) break;
        body.push(line.slice(indent));
      }
      i = j - 1;
      value = body.join(' ').replace(/\s+/g, ' ').trim();
    } else if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key === 'name') out.name = value;
    else out.description = value;
  }
  return out;
}

// File extensions that make a reference executable. Rejected on upload so a skill
// carries only knowledge, never runnable code.
const DISALLOWED_REF_EXTENSIONS = new Set([
  'sh',
  'bash',
  'zsh',
  'js',
  'mjs',
  'cjs',
  'ts',
  'py',
  'rb',
  'pl',
  'php',
  'exe',
  'bat',
  'cmd',
  'ps1',
  'com',
  'bin',
  'so',
  'dll',
  'app',
]);

export function isDisallowedRef(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return DISALLOWED_REF_EXTENSIONS.has(ext);
}

// Upper bound on a fetched or uploaded skill markdown, to keep it in memory safely.
export const MAX_SKILL_BYTES = 1024 * 1024; // 1 MiB

// Import bounds so a large repository cannot pull an unbounded amount of data.
const MAX_SKILL_REFS = 25;
const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MiB total across SKILL.md + references
const MAX_DISCOVER_SKILLS = 50;

// Repository content is read through jsDelivr, not the GitHub API: the flat listing
// endpoint returns the whole file tree in one request, and the CDN serves file
// content. This avoids the GitHub unauthenticated rate limit (60/hour per IP)
// entirely, with no token. The ref is pinned to a commit sha first (see
// resolveCommitSha) so both the listing and the content are fresh. Only public
// repositories are served; a repository too large for jsDelivr to index returns 403.
const JSDELIVR_DATA = 'https://data.jsdelivr.com/v1/packages/gh';
const JSDELIVR_CDN = 'https://cdn.jsdelivr.net/gh';

// The location of a skill folder inside a public GitHub repository.
export interface GithubSkillLocation {
  owner: string;
  repo: string;
  ref: string; // branch/tag/sha; "" means the repository default branch
  subpath: string; // folder holding SKILL.md; "" is the repository root
}

// Rejects path segments that escape the repository root.
function sanitizeSubpath(subpath: string): string {
  const clean = subpath.replace(/^\/+|\/+$/g, '');
  if (clean.split('/').some((seg) => seg === '..')) {
    throw new HttpError(400, 'Invalid path in the GitHub URL');
  }
  return clean;
}

// Parses a github.com URL into the skill folder to import. Accepts a repo root
// (github.com/owner/repo), a /tree/<ref>/<folder> link, or a /blob/<ref>/<file>
// link (the folder containing the file is imported).
export function parseGithubSkillUrl(url: string): GithubSkillLocation {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpError(400, 'Invalid GitHub URL');
  }
  if (parsed.protocol !== 'https:') throw new HttpError(400, 'GitHub URL must be https');
  if (parsed.hostname !== 'github.com') throw new HttpError(400, 'URL must be a github.com link');

  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 2) throw new HttpError(400, 'GitHub URL must include an owner and repository');
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, '');
  const marker = parts[2];
  if (!marker) return { owner, repo, ref: '', subpath: '' };
  if (marker !== 'tree' && marker !== 'blob') {
    throw new HttpError(400, 'GitHub URL must point at a repo, a /tree/ folder, or a /blob/ file');
  }
  const ref = parts[3];
  if (!ref) throw new HttpError(400, 'GitHub URL is missing a branch or ref');
  const rest = parts.slice(4);
  // A blob URL names a file; import the folder that contains it.
  const subpath = marker === 'blob' ? rest.slice(0, -1).join('/') : rest.join('/');
  return { owner, repo, ref, subpath: sanitizeSubpath(subpath) };
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

interface RepoFile {
  path: string; // repository-relative, no leading slash
  size: number;
}

// The flat file tree of a repository at a resolved ref.
interface RepoTree {
  ref: string; // the ref that resolved (the URL's ref, or a probed default branch)
  files: RepoFile[];
}

// Resolves a ref (branch, tag, or the default branch) to a concrete commit sha via
// the public commits atom feed. This is github.com web content, not the REST API, so
// it does not consume the 60/hour unauthenticated REST limit and needs no token or
// git binary. Pinning to a sha is what keeps jsDelivr fresh: its listing endpoint
// caches a moving branch aggressively and can return a stale tree (e.g. old folder
// names after a rename), while an immutable commit is fetched exactly.
async function resolveCommitSha(loc: GithubSkillLocation): Promise<string> {
  if (/^[0-9a-f]{40}$/i.test(loc.ref)) return loc.ref;
  const refs = loc.ref ? [loc.ref] : ['main', 'master'];
  let notFound = false;
  for (const ref of refs) {
    const url = `https://github.com/${loc.owner}/${loc.repo}/commits/${encodePath(ref)}.atom`;
    let res: Response;
    try {
      res = await fetch(url, { headers: { 'User-Agent': 'itsaplan' } });
    } catch {
      throw new HttpError(502, 'Failed to reach GitHub');
    }
    if (res.status === 404) {
      notFound = true;
      continue;
    }
    if (!res.ok) throw new HttpError(502, `GitHub returned ${res.status}`);
    const match = /\/commit\/([0-9a-f]{40})/i.exec(await res.text());
    if (match) return match[1];
    notFound = true;
  }
  if (notFound) throw new HttpError(404, 'GitHub repository or branch not found');
  throw new HttpError(502, 'Failed to resolve the GitHub commit');
}

// Lists every file in the repository in one request. The ref is first pinned to a
// commit sha so the listing is fresh; then jsDelivr's flat listing is read at that
// sha. A repository too large for jsDelivr to index returns 403.
async function fetchTree(loc: GithubSkillLocation): Promise<RepoTree> {
  const sha = await resolveCommitSha(loc);
  const url = `${JSDELIVR_DATA}/${loc.owner}/${loc.repo}@${sha}?structure=flat`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'User-Agent': 'itsaplan' } });
  } catch {
    throw new HttpError(502, 'Failed to reach jsDelivr');
  }
  if (res.status === 403) throw new HttpError(400, 'This GitHub repository is too large to import');
  if (res.status === 404) throw new HttpError(404, 'GitHub repository or branch not found');
  if (!res.ok) throw new HttpError(502, `jsDelivr returned ${res.status}`);
  const data = (await res.json()) as { files?: { name: string; size?: number }[] };
  const files = (data.files ?? []).map((f) => ({
    path: f.name.replace(/^\//, ''),
    size: f.size ?? 0,
  }));
  return { ref: sha, files };
}

// Fetches one file's bytes from the jsDelivr CDN.
async function fetchFile(loc: GithubSkillLocation, ref: string, path: string): Promise<Buffer> {
  const url = `${JSDELIVR_CDN}/${loc.owner}/${loc.repo}@${encodeURIComponent(ref)}/${encodePath(path)}`;
  let res: Response;
  try {
    res = await fetch(url, { redirect: 'follow' });
  } catch {
    throw new HttpError(502, 'Failed to fetch a skill file');
  }
  if (!res.ok) throw new HttpError(502, `jsDelivr returned ${res.status} for a skill file`);
  return Buffer.from(await res.arrayBuffer());
}

export interface ImportedRef {
  path: string; // relative to the skill folder, e.g. "references/example.md"
  bytes: Buffer;
  contentType: string;
}

export interface ImportedSkill {
  markdown: string;
  refs: ImportedRef[];
}

// Imports a skill from a public GitHub folder: the SKILL.md plus every markdown
// reference file in the folder and its subfolders, with paths kept relative to the
// folder so links inside SKILL.md resolve. Only .md files are taken, so scripts and
// other files are never imported. A subfolder that is itself a skill (has its own
// SKILL.md) is left out. Bounded by MAX_SKILL_REFS and MAX_IMPORT_BYTES.
export async function importGithubSkill(url: string): Promise<ImportedSkill> {
  const loc = parseGithubSkillUrl(url);
  const tree = await fetchTree(loc);
  const base = loc.subpath;
  const prefix = base ? `${base}/` : '';
  const skillPath = `${prefix}SKILL.md`;

  const skillFile = tree.files.find((f) => f.path === skillPath);
  if (!skillFile) throw new HttpError(400, 'No SKILL.md found in that GitHub folder');
  if (skillFile.size > MAX_SKILL_BYTES) throw new HttpError(413, 'SKILL.md is too large');
  const markdown = (await fetchFile(loc, tree.ref, skillPath)).toString('utf8');

  // Folders under this one that are their own skills; their files are excluded.
  const nestedSkillDirs = tree.files
    .filter((f) => f.path.endsWith('/SKILL.md') && f.path !== skillPath)
    .map((f) => f.path.slice(0, -'/SKILL.md'.length))
    .filter((d) => d.startsWith(prefix));

  const refs: ImportedRef[] = [];
  let total = Buffer.byteLength(markdown, 'utf8');
  for (const f of tree.files) {
    if (refs.length >= MAX_SKILL_REFS || total >= MAX_IMPORT_BYTES) break;
    if (f.path === skillPath || (prefix && !f.path.startsWith(prefix))) continue;
    // Only markdown references; this is what excludes scripts by construction.
    if (!f.path.toLowerCase().endsWith('.md')) continue;
    if (nestedSkillDirs.some((d) => f.path.startsWith(`${d}/`))) continue;
    if (f.size > MAX_SKILL_BYTES || total + f.size > MAX_IMPORT_BYTES) continue;
    const bytes = await fetchFile(loc, tree.ref, f.path);
    total += bytes.length;
    refs.push({ path: f.path.slice(prefix.length), bytes, contentType: 'text/markdown' });
  }
  return { markdown, refs };
}

// A skill found in a GitHub repository, ready to be imported one at a time.
export interface DiscoveredSkill {
  name: string;
  description: string;
  subpath: string; // folder within the repo, "" for the repo root
  url: string; // ready-to-import github.com URL for this one skill
}

// Finds the skills at a GitHub URL. If the target folder holds a SKILL.md it is the
// single skill; otherwise every folder under it that has a SKILL.md is a skill
// (catalog layouts). name and description come from each SKILL.md's frontmatter,
// falling back to the folder name.
export async function discoverGithubSkills(url: string): Promise<DiscoveredSkill[]> {
  const loc = parseGithubSkillUrl(url);
  const tree = await fetchTree(loc);
  const base = loc.subpath;
  const prefix = base ? `${base}/` : '';

  let skillDirs: string[];
  if (tree.files.some((f) => f.path === `${prefix}SKILL.md`)) {
    skillDirs = [base];
  } else {
    skillDirs = tree.files
      .filter((f) => f.path.endsWith('/SKILL.md') && f.path.startsWith(prefix))
      .map((f) => f.path.slice(0, -'/SKILL.md'.length));
  }
  if (skillDirs.length === 0) {
    throw new HttpError(400, 'No SKILL.md found in that GitHub repository');
  }
  skillDirs = skillDirs.slice(0, MAX_DISCOVER_SKILLS);

  const skills: DiscoveredSkill[] = [];
  for (const dir of skillDirs) {
    const skillPath = dir ? `${dir}/SKILL.md` : 'SKILL.md';
    const meta = tree.files.find((f) => f.path === skillPath);
    const folderName = dir.split('/').pop() || loc.repo;
    let name = folderName;
    let description = '';
    if (meta && meta.size <= MAX_SKILL_BYTES) {
      const fm = parseFrontmatter((await fetchFile(loc, tree.ref, skillPath)).toString('utf8'));
      name = (fm.name || folderName).trim();
      description = (fm.description || '').trim();
    }
    const path = dir ? `/tree/${tree.ref}/${encodePath(dir)}` : `/tree/${tree.ref}`;
    skills.push({
      name,
      description,
      subpath: dir,
      url: `https://github.com/${loc.owner}/${loc.repo}${path}`,
    });
  }
  return skills;
}
