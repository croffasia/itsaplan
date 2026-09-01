import { useEffect, useState } from 'react';
import { type Editor } from '@tiptap/react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  type Attachment,
  type ProjectDetail,
  type IssueDetail as IssueDetailRow,
  type IssueFieldValueInput,
  type IssuePatch,
} from '@/lib/api';
import { useIssueQuery, useSetFieldValue, useUpdateIssue } from '@/services/issues.service';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { revScope } from '@/utils/revScopes';
import { qk } from '@/services/queryKeys';
import { useAccountPreferencesQuery } from '@/services/preferences.service';
import { useAttachmentsQuery, useUploadAttachment } from '../services/attachments.service';
import { useFeedQuery, useGroupedFeedQuery, useTimelineQuery } from '../services/comments.service';
import { attachmentMarkdown, isImage } from '../utils/attachmentEmbed';
import { fieldDefsForType } from '../utils/fieldDefs';

// Loads one issue and exposes the edit operations for the detail surfaces.
// onIssueLoaded surfaces the loaded issue to the surrounding chrome.
export function useIssueDetail(
  project: ProjectDetail,
  issueId: number,
  onIssueLoaded?: (issue: IssueDetailRow) => void,
) {
  const t = useTranslations('issue.attachments');
  const issueQuery = useIssueQuery(issueId);
  const issue = issueQuery.data ?? null;
  const fieldDefs = fieldDefsForType(project.customFields, issue?.typeId ?? null);

  // Started here, not in the components that read them: those mount only after the
  // issue arrives, which would put these reads in a second wave after it. Only the
  // activity shape the preference opens with is read; the other one waits for a switch.
  const attachmentsQuery = useAttachmentsQuery(issueId);
  // Undefined until the preferences arrive — the saved shape is read, never the
  // default standing in for it, so neither feed is fetched to be thrown away.
  const activityView = useAccountPreferencesQuery().data?.issueActivityView;
  useTimelineQuery(issueId);
  useFeedQuery(issueId, activityView === 'flat');
  useGroupedFeedQuery(issueId, activityView === 'grouped');

  // What the markdown editors' image picker offers.
  const imageAttachments = (attachmentsQuery.data ?? []).filter(isImage);

  const updateIssue = useUpdateIssue(project.project.key);
  const setFieldValue = useSetFieldValue(project.project.key);
  const uploadAttachment = useUploadAttachment();
  const [descEditor, setDescEditor] = useState<Editor | null>(null);

  // Live detail: refetch the issue and its feed on any change, so edits and new
  // comments (including an agent's reply to a mention) show without a manual reload.
  useLiveRefresh({
    scope: revScope.issue(issueId),
    targets: [
      qk.issue(issueId),
      qk.feed(issueId),
      qk.issueDocumentLinks(project.project.key, issueId),
    ],
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

  // Appends markdown to the description. Reads the description from the live
  // editor so unsaved typing is preserved, then saves the combined text.
  function appendToDescription(snippet: string) {
    if (!issue) return;
    const current = (
      descEditor ? descEditor.storage.markdown.getMarkdown() : issue.description
    ).trim();
    patch({ description: current ? `${current}\n\n${snippet}` : snippet });
  }

  function insertAttachment(a: Attachment) {
    appendToDescription(attachmentMarkdown(a));
  }

  // Files with no editor to insert them into: upload them all, then append them
  // to the description in one save.
  async function attachFiles(files: FileList) {
    const embeds: string[] = [];
    for (const file of Array.from(files)) {
      const a = await uploadFile(file).catch(() => null);
      if (a) embeds.push(attachmentMarkdown(a));
    }
    if (embeds.length > 0) {
      appendToDescription(embeds.join('\n\n'));
      toast.success(t('attachedCount', { count: embeds.length }));
    }
    const failed = files.length - embeds.length;
    if (failed > 0) {
      toast.error(t('uploadFailedCount', { count: failed }));
    }
  }

  return {
    issue,
    fieldDefs,
    patch,
    setField,
    toggleLabel,
    insertAttachment,
    attachFiles,
    uploadFile,
    imageAttachments,
    setDescEditor,
  };
}
