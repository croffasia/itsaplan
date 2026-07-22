import { useEffect, useState } from 'react';
import { type Editor } from '@tiptap/react';
import {
  api,
  type Attachment,
  type ProjectDetail,
  type IssueDetail as IssueDetailRow,
  type IssueFieldValueInput,
  type IssuePatch,
} from '@/lib/api';
import { useCustomFieldsQuery } from '@/services/customFields.service';
import { useIssueQuery, useSetFieldValue, useUpdateIssue } from '@/services/issues.service';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { qk } from '@/services/queryKeys';
import { useUploadAttachment } from '../services/attachments.service';
import { attachmentMarkdown } from '../utils/attachmentEmbed';

// Loads one issue with its type-scoped custom fields (global + type-scoped) and
// exposes the edit operations for the detail surfaces. A patch mutates the
// project optimistically and invalidates the issue, comments and activity
// queries, so the properties and feed refresh without a manual reload. The
// panel (IssueDetail) and full page (IssueViewPage) render the returned data;
// this hook owns the fetch and mutation logic so those components stay layout
// only. onIssueLoaded surfaces the loaded issue to the surrounding chrome
// (identifier breadcrumb).
export function useIssueDetail(
  project: ProjectDetail,
  issueId: number,
  onIssueLoaded?: (issue: IssueDetailRow) => void,
) {
  const issueQuery = useIssueQuery(issueId);
  const issue = issueQuery.data ?? null;
  const fieldsQuery = useCustomFieldsQuery(project.project.key, issue?.typeId ?? undefined);
  const fieldDefs = fieldsQuery.data ?? [];
  const updateIssue = useUpdateIssue(project.project.key);
  const setFieldValue = useSetFieldValue(project.project.key);
  const uploadAttachment = useUploadAttachment();
  const [descEditor, setDescEditor] = useState<Editor | null>(null);

  // Live detail: poll the issue's change marker and refetch the issue + feed when it
  // moves, so edits and new comments (including an agent's reply to a mention) show
  // without a manual reload.
  useLiveRefresh({
    revKey: ['rev', 'issue', issueId],
    fetchRev: () => api.getIssueRev(issueId),
    targets: [qk.issue(issueId), qk.feed(issueId)],
    intervalMs: 5000,
  });

  // Upload a file dropped onto a markdown editor. Returns the attachment so the
  // editor can insert it at the drop position; the mutation also refreshes the
  // Attachments panel.
  const uploadFile = (file: File) => uploadAttachment.mutateAsync({ issueId, file });

  useEffect(() => {
    if (issue) onIssueLoaded?.(issue);
  }, [issue, onIssueLoaded]);

  function patch(fields: IssuePatch) {
    updateIssue.mutate({ id: issueId, patch: fields });
  }

  function setField(fieldId: number, value: IssueFieldValueInput) {
    setFieldValue.mutate({ issueId, fieldId, value });
  }

  function toggleLabel(id: number) {
    if (!issue) return;
    const next = issue.labelIds.includes(id)
      ? issue.labelIds.filter((x) => x !== id)
      : [...issue.labelIds, id];
    patch({ labelIds: next });
  }

  // Appends an attachment to the description. Reads the description from the
  // live editor so unsaved typing is preserved, then saves the combined text.
  function insertAttachment(a: Attachment) {
    if (!issue) return;
    const snippet = attachmentMarkdown(a);
    const current = (
      descEditor ? descEditor.storage.markdown.getMarkdown() : issue.description
    ).trim();
    patch({ description: current ? `${current}\n\n${snippet}` : snippet });
  }

  return {
    issue,
    fieldDefs,
    patch,
    setField,
    toggleLabel,
    insertAttachment,
    uploadFile,
    setDescEditor,
  };
}
