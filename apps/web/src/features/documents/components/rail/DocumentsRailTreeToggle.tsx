'use client';

import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { useDocumentTreeExpanded } from '../../hooks/useDocumentTreeExpanded';
import { documentBranchIds } from '../../utils/documentTree';
import DocumentIconButton from '../DocumentIconButton';

export default function DocumentsRailTreeToggle({
  projectKey,
  documents,
}: {
  projectKey: string;
  documents: ProjectDocumentSummary[];
}) {
  const t = useTranslations('documents');
  const { expanded, expand, collapseAll } = useDocumentTreeExpanded(projectKey);
  const branchIds = documentBranchIds(documents);
  if (branchIds.length === 0) return null;

  return branchIds.some((id) => expanded.has(id)) ? (
    <DocumentIconButton label={t('collapseAll')} onClick={collapseAll}>
      <ChevronsDownUp />
    </DocumentIconButton>
  ) : (
    <DocumentIconButton label={t('expandAll')} onClick={() => expand(branchIds)}>
      <ChevronsUpDown />
    </DocumentIconButton>
  );
}
