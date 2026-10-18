import { Agent } from '@mastra/core/agent';
import { db, teamAiAssist } from '@repo/db';
import { eq } from 'drizzle-orm';
import { HttpError } from '#shared/lib';
import type { ProjectRow } from '#modules/projects/service';
import { createColumn, listColumns } from '#modules/columns/service';
import { createIssue } from '#modules/issues/service';
import { createChecklist, createChecklistItem } from '#modules/issues/checklists';
import { getCredentialById, getCredentialSecret } from '#modules/agents/integrations/service';
import { integrationKind } from '#modules/agents/integrations/catalog';
import { parseDueDate } from './due-date';

export interface AiAssistSettings {
  credentialId: number | null;
  model: string | null;
}

type StateType = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';

export interface BoardDraft {
  columns: { name: string; stateType: StateType }[];
  issues: { title: string; description: string; column: string; dueDate: string | null }[];
}

export interface ChecklistDraft {
  title: string;
  items: string[];
}

export const NOT_CONFIGURED =
  'AI assist is off for this team: pick a model credential in the team settings';

export async function getAiAssistSettings(teamId: number): Promise<AiAssistSettings> {
  const rows = await db.select().from(teamAiAssist).where(eq(teamAiAssist.teamId, teamId));
  return { credentialId: rows[0]?.credentialId ?? null, model: rows[0]?.model ?? null };
}

export async function setAiAssistSettings(
  teamId: number,
  input: { credentialId: number | null; model?: string },
): Promise<AiAssistSettings> {
  if (input.credentialId == null) {
    await db.delete(teamAiAssist).where(eq(teamAiAssist.teamId, teamId));
    return { credentialId: null, model: null };
  }
  const credential = await getCredentialById(input.credentialId, teamId);
  if (!credential || integrationKind(credential.integrationKey) !== 'llm')
    throw new HttpError(400, 'The credential must be an LLM credential of this team');
  if (!input.model) throw new HttpError(400, 'A model is required');
  const values = { teamId, credentialId: input.credentialId, model: input.model };
  await db
    .insert(teamAiAssist)
    .values(values)
    .onConflictDoUpdate({ target: teamAiAssist.teamId, set: { ...values, updatedAt: new Date() } });
  return { credentialId: values.credentialId, model: values.model };
}

// Asks the team's model for one JSON object and returns it parsed. The answer is read
// from the text rather than through a provider's JSON mode, which not every
// OpenAI-compatible endpoint supports.
async function askJson(teamId: number, instructions: string, prompt: string): Promise<unknown> {
  const settings = await getAiAssistSettings(teamId);
  if (settings.credentialId == null || !settings.model) throw new HttpError(409, NOT_CONFIGURED);
  const secret = await getCredentialSecret(settings.credentialId, teamId);
  if (!secret) throw new HttpError(409, NOT_CONFIGURED);
  const baseUrl = secret.config.baseUrl ? String(secret.config.baseUrl) : null;
  const agent = new Agent({
    id: `ai-assist-${teamId}`,
    name: 'AI assist',
    instructions,
    model: {
      providerId: secret.integrationKey,
      modelId: settings.model,
      apiKey: String(secret.config.apiKey ?? ''),
      ...(baseUrl ? { url: baseUrl } : {}),
    },
  });
  let text: string;
  try {
    text = (await agent.generate(prompt)).text ?? '';
  } catch (err) {
    console.error('[ai-assist] model call failed', err);
    throw new HttpError(502, 'The model did not answer');
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new HttpError(502, 'The model did not answer with JSON');
  }
}

const STATE_TYPES: StateType[] = ['backlog', 'unstarted', 'started', 'completed', 'canceled'];

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function list(value: unknown, max: number): unknown[] {
  return Array.isArray(value) ? value.slice(0, max) : [];
}

const BOARD_INSTRUCTIONS = `You set up project boards. Answer with one JSON object and nothing else:
{"columns":[{"name":string,"stateType":"backlog"|"unstarted"|"started"|"completed"|"canceled"}],
 "issues":[{"title":string,"description":string,"column":string,"dueDate":"YYYY-MM-DD"|null}]}
Propose 3 to 7 columns in workflow order and up to 20 issues. Every issue's column is the name of one of the columns. Write in the language of the request.`;

export async function draftBoard(project: ProjectRow, prompt: string): Promise<BoardDraft> {
  const raw = (await askJson(project.teamId, BOARD_INSTRUCTIONS, prompt)) as Record<
    string,
    unknown
  >;
  const columns = list(raw.columns, 12)
    .map((c) => c as Record<string, unknown>)
    .map((c) => ({
      name: str(c.name, 100),
      stateType: STATE_TYPES.includes(c.stateType as StateType)
        ? (c.stateType as StateType)
        : 'unstarted',
    }))
    .filter((c) => c.name);
  const issues = list(raw.issues, 50)
    .map((i) => i as Record<string, unknown>)
    .map((i) => {
      const title = str(i.title, 500);
      const due = str(i.dueDate, 10);
      return {
        title,
        description: str(i.description, 5000),
        column: str(i.column, 100),
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : parseDueDate(title),
      };
    })
    .filter((i) => i.title);
  if (columns.length === 0 && issues.length === 0)
    throw new HttpError(502, 'The model proposed nothing');
  return { columns, issues };
}

// Creates the confirmed draft: the columns the project does not have yet, matched by
// name, then the issues, each in its column or else the first column of the board.
export async function applyBoard(
  project: ProjectRow,
  draft: BoardDraft,
  actorUserId: string,
): Promise<{ columns: number; issues: number }> {
  const byName = new Map(
    (await listColumns(project.id)).map((c) => [c.name.toLowerCase(), c.id] as const),
  );
  let createdColumns = 0;
  for (const column of draft.columns) {
    if (byName.has(column.name.toLowerCase())) continue;
    const created = await createColumn({ projectId: project.id, ...column });
    byName.set(column.name.toLowerCase(), created.id);
    createdColumns++;
  }
  const fallback =
    byName.get(draft.columns[0]?.name.toLowerCase() ?? '') ?? [...byName.values()][0];
  if (draft.issues.length > 0 && fallback === undefined)
    throw new HttpError(400, 'The board needs a column for the issues');
  for (const item of draft.issues) {
    await createIssue(
      project,
      {
        title: item.title,
        description: item.description,
        columnId: byName.get(item.column.toLowerCase()) ?? fallback!,
        dueDate: item.dueDate ?? parseDueDate(item.title),
      },
      actorUserId,
    );
  }
  return { columns: createdColumns, issues: draft.issues.length };
}

const CHECKLIST_INSTRUCTIONS = `You break work items into checklist steps. Answer with one JSON object and nothing else:
{"title":string,"items":[string]}
Give 3 to 10 short, concrete steps in order. Write in the language of the work item.`;

export async function draftChecklist(
  teamId: number,
  issue: { title: string; description: string },
): Promise<ChecklistDraft> {
  const raw = (await askJson(
    teamId,
    CHECKLIST_INSTRUCTIONS,
    `Title: ${issue.title}\n\nDescription:\n${issue.description || '(none)'}`,
  )) as Record<string, unknown>;
  const items = list(raw.items, 30)
    .map((item) => str(item, 500))
    .filter(Boolean);
  if (items.length === 0) throw new HttpError(502, 'The model proposed no steps');
  return { title: str(raw.title, 200) || 'Checklist', items };
}

export async function applyChecklist(issueId: number, draft: ChecklistDraft, actorUserId: string) {
  const checklist = await createChecklist(issueId, draft.title, actorUserId);
  const items = [];
  for (const content of draft.items)
    items.push(await createChecklistItem(checklist.id, content, actorUserId));
  return { ...checklist, items };
}
