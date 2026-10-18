import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { driveRoot, drivePath, graphRequest, graphText, msCredential } from './client';

const MAX_READ_CHARS = 50_000;
// Graph takes a simple PUT upload up to 250 MB; an agent writes text, so far less.
const MAX_UPLOAD_CHARS = 4_000_000;

const where = {
  user: z
    .string()
    .optional()
    .describe('Email of the user whose OneDrive to use. Defaults to the credential default user.'),
  siteId: z
    .string()
    .optional()
    .describe(
      'SharePoint site id (from microsoft365_sites_search) to use its document library instead of a OneDrive.',
    ),
};

function fileSummary(item: Record<string, unknown>) {
  const parent = item.parentReference as { path?: string } | undefined;
  return {
    id: String(item.id ?? ''),
    name: String(item.name ?? ''),
    folder: Boolean(item.folder),
    size: item.size ?? null,
    path: parent?.path ? `${parent.path.replace(/^\/drive\/root:?/, '')}/${item.name}` : null,
    webUrl: item.webUrl ?? null,
    lastModified: item.lastModifiedDateTime ?? null,
  };
}

export const microsoft365FilesSearch: CustomToolEntry = {
  key: 'microsoft365_files_search',
  label: 'Microsoft 365 Search Files',
  scopes: ['Files.Read.All'],
  description:
    'Search files and folders in a OneDrive or a SharePoint document library by name and content. Returns each match with its id, which microsoft365_file_read takes.',
  inputSchema: z.object({
    query: z.string().min(1).describe('Words to search for.'),
    ...where,
    limit: z.number().int().min(1).max(50).optional().describe('How many results (default 10).'),
  }),
  execute: async (credential, input) => {
    const cred = msCredential(credential);
    const q = String(input.query).replace(/'/g, "''");
    const body = await graphRequest(cred, {
      path: `${driveRoot(cred, input)}/root/search(q='${encodeURIComponent(q)}')?$top=${Number(input.limit ?? 10)}`,
      permission: 'Files.Read.All',
    });
    return { results: (body.value ?? []).map(fileSummary) };
  },
};

export const microsoft365FilesList: CustomToolEntry = {
  key: 'microsoft365_files_list',
  label: 'Microsoft 365 List Folder',
  scopes: ['Files.Read.All'],
  description:
    'List the files and folders in a OneDrive or SharePoint folder. Omit the path for the top folder.',
  inputSchema: z.object({
    path: z.string().optional().describe('Folder path, e.g. "Projects/2026". Omit for the top.'),
    ...where,
  }),
  execute: async (credential, input) => {
    const cred = msCredential(credential);
    const folder = String(input.path ?? '').trim();
    const target = folder ? `root:/${drivePath(folder)}:` : 'root';
    const body = await graphRequest(cred, {
      path: `${driveRoot(cred, input)}/${target}/children?$top=200`,
      permission: 'Files.Read.All',
    });
    return { items: (body.value ?? []).map(fileSummary) };
  },
};

export const microsoft365FileRead: CustomToolEntry = {
  key: 'microsoft365_file_read',
  label: 'Microsoft 365 Read File',
  scopes: ['Files.Read.All'],
  description:
    'Read a text file (txt, md, csv, json, html, code) from a OneDrive or SharePoint library, by id or by path. Word, Excel and PDF files are returned as their Office web link only.',
  inputSchema: z.object({
    fileId: z.string().optional().describe('The file id from a search or folder listing.'),
    path: z
      .string()
      .optional()
      .describe('The file path, e.g. "Notes/plan.md", when no id is known.'),
    ...where,
  }),
  execute: async (credential, input) => {
    const cred = msCredential(credential);
    const root = driveRoot(cred, input);
    const id = String(input.fileId ?? '').trim();
    if (!id && !input.path) throw new Error('Pass a fileId or a path.');
    const item = id ? `items/${encodeURIComponent(id)}` : `root:/${drivePath(input.path)}:`;
    const meta = await graphRequest(cred, {
      path: `${root}/${item}`,
      permission: 'Files.Read.All',
    });
    const content = await graphText(
      cred,
      { path: `${root}/${item}/content`, permission: 'Files.Read.All' },
      MAX_READ_CHARS,
    );
    return {
      ...fileSummary(meta),
      contentType: content.contentType,
      text: content.text,
      truncated: content.truncated,
      ...(content.text ? {} : { note: 'Not a text file; open it with webUrl.' }),
    };
  },
};

export const microsoft365FileWrite: CustomToolEntry = {
  key: 'microsoft365_file_write',
  writes: true,
  label: 'Microsoft 365 Write File',
  scopes: ['Files.ReadWrite.All'],
  description:
    'Create or replace a text file in a OneDrive or SharePoint library at the given path. Missing folders on the path are created.',
  inputSchema: z.object({
    path: z.string().min(1).describe('File path including the name, e.g. "Reports/weekly.md".'),
    content: z.string().max(MAX_UPLOAD_CHARS).describe('The file content.'),
    ...where,
  }),
  execute: async (credential, input) => {
    const cred = msCredential(credential);
    const item = await graphRequest(cred, {
      method: 'PUT',
      path: `${driveRoot(cred, input)}/root:/${drivePath(input.path)}:/content`,
      permission: 'Files.ReadWrite.All',
      raw: { body: String(input.content), contentType: 'text/plain' },
    });
    return fileSummary(item);
  },
};

export const microsoft365SitesSearch: CustomToolEntry = {
  key: 'microsoft365_sites_search',
  label: 'Microsoft 365 Search SharePoint Sites',
  scopes: ['Sites.Read.All'],
  description:
    'Find SharePoint sites by name. Returns each site id, which the file tools take as siteId.',
  inputSchema: z.object({ query: z.string().min(1).describe('Words in the site name.') }),
  execute: async (credential, input) => {
    const cred = msCredential(credential);
    const body = await graphRequest(cred, {
      path: `sites?search=${encodeURIComponent(String(input.query))}`,
      permission: 'Sites.Read.All',
    });
    return {
      results: (body.value ?? []).map((site) => ({
        id: String(site.id ?? ''),
        name: site.displayName ?? site.name ?? null,
        webUrl: site.webUrl ?? null,
      })),
    };
  },
};
