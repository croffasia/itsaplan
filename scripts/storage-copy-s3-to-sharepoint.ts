#!/usr/bin/env bun
// One-off: copies every stored object from the S3 store into SharePoint / OneDrive,
// for an instance that switches STORAGE_DRIVER from s3 to sharepoint.
//
//   bun --env-file=.env scripts/storage-copy-s3-to-sharepoint.ts [--dry-run]
//
// Reads the S3_* and SHAREPOINT_* variables (STORAGE_DRIVER is ignored: the source is
// always S3 and the target always SharePoint) and DATABASE_URL. Object keys come from
// the tables that reference them: issue, chat, initiative and document attachments,
// skill files, and avatars. Same key on both sides, so nothing in the database changes.
// Safe to re-run: a target file that already exists is replaced with identical bytes,
// and a source object that is missing is reported and skipped. Does not delete from S3.
import { SQL } from 'bun';
import {
  createS3Driver,
  createSharePointDriver,
  sharePointConfigFromEnv,
} from '../packages/storage/src/index.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set.');
const sql = new SQL(databaseUrl);

const dryRun = process.argv.includes('--dry-run');

async function column(query: PromiseLike<unknown>): Promise<string[]> {
  return ((await query) as { key: string | null }[])
    .map((r) => r.key)
    .filter((k): k is string => typeof k === 'string' && k !== '');
}

async function listKeys(): Promise<string[]> {
  const keys = new Set<string>();
  const add = (list: string[]) => list.forEach((k) => keys.add(k));
  add(await column(sql`SELECT s3_key AS key FROM issue_attachment`));
  add(await column(sql`SELECT s3_key AS key FROM chat_attachment`));
  add(await column(sql`SELECT s3_key AS key FROM initiative_attachment`));
  add(await column(sql`SELECT s3_key AS key FROM document_asset`));
  add(await column(sql`SELECT s3_prefix || '/SKILL.md' AS key FROM agent_skill`));
  add(
    await column(
      sql<
        { key: string | null }[]
      >`SELECT f->>'s3Key' AS key FROM agent_skill, jsonb_array_elements(files) AS f`,
    ),
  );
  add(
    await column(
      sql<
        { key: string | null }[]
      >`SELECT 'avatars/' || substring(image FROM '^/avatars/([^/]+)/raw$') AS key FROM "user" WHERE image ~ '^/avatars/[^/]+/raw$'`,
    ),
  );
  return [...keys].sort();
}

const source = createS3Driver();
const target = dryRun ? null : createSharePointDriver(sharePointConfigFromEnv());

const keys = await listKeys();
await sql.end();
console.log(`${keys.length} object keys in the database${dryRun ? ' (dry run)' : ''}`);

let copied = 0;
let missing = 0;
let failed = 0;
for (const key of keys) {
  if (!target) continue;
  try {
    const object = await source.get(key).catch((error: unknown) => {
      const name = (error as { name?: string })?.name;
      if (name === 'NoSuchKey' || name === 'NotFound') return null;
      throw error;
    });
    if (!object) {
      missing++;
      console.warn(`missing in S3, skipped: ${key}`);
      continue;
    }
    const bytes = Buffer.from(await new Response(object.body).arrayBuffer());
    await target.put(key, bytes, object.contentType);
    copied++;
    console.log(`copied ${key} (${bytes.length} bytes)`);
  } catch (error) {
    failed++;
    console.error(`FAILED ${key}:`, error instanceof Error ? error.message : error);
  }
}

console.log(`done: ${copied} copied, ${missing} missing, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
