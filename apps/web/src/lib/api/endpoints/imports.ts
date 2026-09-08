// Issue imports: a chat attachment an agent mapped into issues, awaiting confirmation.

import { request } from '@/lib/api/core/client';

export interface IssueImport {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  status: 'mapped' | 'confirmed' | 'canceled' | 'failed';
  mapping: Record<string, string> | null;
  errorText: string | null;
  createdAt: string;
  preview?: {
    columns: { field: string; header: string }[];
    rows: { cells: string[]; skip: string | null }[];
    totalRows: number;
  };
}

export interface ImportConfirmResult {
  imported: { key: string; title: string }[];
  skipped: { row: number; reason: string }[];
}

export async function getImport(importId: string): Promise<IssueImport> {
  return request(`/imports/${importId}`);
}

export async function confirmImport(importId: string): Promise<ImportConfirmResult> {
  return request(`/imports/${importId}/confirm`, { method: 'POST' });
}

export async function discardImport(importId: string): Promise<void> {
  await request(`/imports/${importId}/cancel`, { method: 'POST' });
}
