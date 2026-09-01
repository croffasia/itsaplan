import { type CSSProperties, useRef, useState } from 'react';
import { Direction } from 'radix-ui';
import { type ProjectDetail, type IssueDetail as IssueDetailRow } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { usePersistedWidth } from '@/hooks/usePersistedWidth';
import { useProjectFeatures } from '@/hooks/useProjectFeatures';
import ResizeGrip from '@/components/common/ResizeGrip';
import { useIssueDetail } from '../../hooks/useIssueDetail';
import { usePersistedOpen, usePersistedOpenGroups } from '../../hooks/usePersistedOpen';
import { useFilePaste } from '../../hooks/useFilePaste';
import IssueAttachmentsPanel from './IssueAttachmentsPanel';
import IssueChecklistsPanel from './IssueChecklistsPanel';
import IssueLinksPanel from './IssueLinksPanel';
import IssueDevelopmentPanel from './IssueDevelopmentPanel';
import IssueDocumentsPanel from './IssueDocumentsPanel';
import IssueWorklogPanel from './IssueWorklogPanel';
import IssueSubtasksPanel from './IssueSubtasksPanel';
import IssueActivityFeed from './IssueActivityFeed';
import LastCommentBubble from './LastCommentBubble';
import IssueDetailSkeleton from './IssueDetailSkeleton';
import IssueStatusTimeline from './IssueStatusTimeline';
import IssueMarkdownEditor from '../editor/IssueMarkdownEditor';
import IssueCustomFieldBody from '../fields/IssueCustomFieldBody';
import IssueProperties from './IssueProperties';
import IssueActionsBar from '../actions/IssueActionsBar';
import {
  PROPERTIES_MAX_W,
  PROPERTIES_MIN_W,
  PROPERTIES_W,
  propertiesWidthKey,
} from '../../utils/propertiesWidth';
import { useTranslations } from 'next-intl';

// The body of a issue — title, description, markdown custom fields, the
// Properties grid, attachments, and the activity feed. Shared by the side panel
// (IssueDetail) and the full-page view (IssueViewPage); each supplies its own
// surrounding chrome (close button / breadcrumbs). Without work_items edit every
// part of it renders as a static value. Data loading and mutations live in
// useIssueDetail; this component is layout only.
export default function IssueDetailContent({
  project,
  issueId,
  onIssueLoaded,
  onDeleted,
  layout = 'panel',
}: {
  project: ProjectDetail;
  issueId: number;
  onIssueLoaded?: (issue: IssueDetailRow) => void;
  // Called after the issue is deleted, so the surrounding chrome can leave the
  // now-gone issue (close the panel / return to the project).
  onDeleted?: () => void;
  // 'panel' stacks everything in one column (side panel). 'page' puts the
  // Properties in a right sidebar fixed to the viewport edge (Linear full-page
  // layout), and stacks them into the column below xl. 'split' is the same
  // two-column shape but in normal flow (no fixed positioning), so it fits
  // inside a narrower container like the inbox pane.
  layout?: 'panel' | 'page' | 'split';
}) {
  const t = useTranslations('issue');
  const tCommon = useTranslations('common');
  const tEditor = useTranslations('issue.editor');
  const direction = Direction.useDirection();
  const {
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
  } = useIssueDetail(project, issueId, onIssueLoaded);
  const permissions = usePermissions(project);
  const canEdit = permissions.can('work_items', 'edit');
  const canReadDocuments = permissions.can('documents', 'read');
  const canLinkDocuments = canEdit && permissions.can('documents', 'edit');
  const features = useProjectFeatures();
  useFilePaste(canEdit && issue ? (files) => void attachFiles(files) : null);
  const properties = usePersistedOpen('issue-properties-open');
  const propertyGroups = usePersistedOpenGroups('issue-property-groups-closed');
  const { width: propertiesWidth, setWidth: setPropertiesWidth } = usePersistedWidth(
    propertiesWidthKey(project.project.key),
    PROPERTIES_W,
    PROPERTIES_MIN_W,
    PROPERTIES_MAX_W,
  );
  // A replaced attachment keeps its URL, so an <img> already in an editor is
  // never requested again. Counting the replacements remounts the editors, which
  // builds the element anew and lets the raw route revalidate it.
  const [replacements, setReplacements] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);

  if (!issue) return <IssueDetailSkeleton />;

  const heading = (
    <>
      <div className="flex items-start gap-2">
        {issue.archivedAt && (
          <span className="mt-1 shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
            {t('archived')}
          </span>
        )}
        {canEdit ? (
          // A textarea, not an input, so a long title wraps and is shown in full.
          // Its value stays single-line: Enter commits instead of inserting a
          // newline, and pasted line breaks are collapsed on blur.
          <textarea
            // Laid out by the script the title is written in, not the interface
            // language, so an Arabic title reads correctly in an English session.
            dir="auto"
            className="field-sizing-content min-w-0 flex-1 resize-none bg-transparent text-lg leading-snug font-semibold outline-none placeholder:text-muted-foreground"
            rows={1}
            placeholder={t('titlePlaceholder')}
            defaultValue={issue.title}
            key={`title-${issue.updatedAt}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            onBlur={(e) => {
              const next = e.target.value.replace(/\s+/g, ' ').trim();
              e.target.value = next;
              if (next && next !== issue.title) patch({ title: next });
            }}
          />
        ) : (
          <h1 dir="auto" className="min-w-0 flex-1 text-lg leading-snug font-semibold">
            {issue.title}
          </h1>
        )}
      </div>

      {(canEdit || issue.description.trim() !== '') && (
        <IssueMarkdownEditor
          className="mt-4"
          placeholder={tEditor('descriptionPlaceholder')}
          defaultValue={issue.description}
          key={`desc-${issue.updatedAt}-${replacements}`}
          editable={canEdit}
          onReady={setDescEditor}
          uploadFile={uploadFile}
          imageAttachments={imageAttachments}
          onBlur={(md) => {
            if (md !== issue.description) patch({ description: md });
          }}
        />
      )}

      {fieldDefs
        .filter((def) => def.showInBody)
        .map((def) => (
          <IssueCustomFieldBody
            key={def.id}
            def={def}
            current={issue.fields.find((f) => f.fieldId === def.id)}
            assignees={project.assignees}
            saveKey={`${def.id}-${issue.updatedAt}-${replacements}`}
            uploadFile={uploadFile}
            imageAttachments={imageAttachments}
            onSetField={setField}
            readOnly={!canEdit}
          />
        ))}
    </>
  );

  // The collapsible sections under the written content. Where the Properties are
  // not a sidebar of their own they go between the two, so the sections stay at
  // the bottom of the column.
  const sections = (
    <>
      <IssueAttachmentsPanel
        issueId={issue.id}
        onInsert={insertAttachment}
        onReplaced={() => setReplacements((n) => n + 1)}
        readOnly={!canEdit}
      />

      {features.subtasks && <IssueSubtasksPanel project={project} issue={issue} />}

      {features.checklists && <IssueChecklistsPanel issue={issue} />}

      {features.timeLogging && <IssueWorklogPanel project={project} issue={issue} />}

      <IssueDevelopmentPanel issueId={issue.id} links={issue.development ?? []} canEdit={canEdit} />

      {features.documents && (
        <IssueDocumentsPanel
          projectKey={project.project.key}
          issueId={issue.id}
          canRead={canReadDocuments}
          canLink={canLinkDocuments}
        />
      )}

      <IssueLinksPanel project={project} issue={issue} />
    </>
  );

  const renderProperties = (className?: string) => (
    <IssueProperties
      project={project}
      issue={issue}
      fieldDefs={fieldDefs}
      onPatch={patch}
      onSetField={setField}
      onToggleLabel={toggleLabel}
      uploadFile={uploadFile}
      imageAttachments={imageAttachments}
      watchers={issue.watchers}
      readOnly={!canEdit}
      className={className}
      open={properties.open}
      onToggle={properties.toggle}
      groupsOpen={propertyGroups}
    />
  );
  // In a sidebar the section follows the actions row, which needs less room above
  // it than the content block it follows in a single column.
  const sidebarProperties = renderProperties('mt-3 pt-4');

  const actions = <IssueActionsBar project={project} issue={issue} onDeleted={onDeleted} />;

  // The sidebar grows towards the content, so the pointer moving away from the
  // edge the panel sits on is what widens it.
  const propertiesGrip = (
    <ResizeGrip
      label={tCommon('resizePropertiesPanel')}
      className="absolute inset-y-0 start-0 -ms-3"
      onDrag={(deltaX) =>
        setPropertiesWidth(propertiesWidth + (direction === 'rtl' ? deltaX : -deltaX))
      }
    />
  );
  // The dragged width reaches the layout as a variable, since the two blocks it
  // sizes only take it from the breakpoint where the sidebar exists.
  const propertiesWidthVar = { '--issue-properties-w': `${propertiesWidth}px` } as CSSProperties;

  // A feed entry stores the author's name, not their picture, so the uploaded avatar
  // comes from the project's candidate list by actor id. An author who is no longer a
  // member falls back to the initials circle.
  const imageByUserId = new Map(project.assignees.map((a) => [a.userId, a.image]));

  const activity = (
    <>
      {features.issueStats && (
        <IssueStatusTimeline
          issueId={issue.id}
          columns={project.columns}
          imageByUserId={imageByUserId}
        />
      )}
      <div ref={feedRef}>
        <IssueActivityFeed
          issueId={issue.id}
          assignees={project.assignees}
          columns={project.columns}
          imageByUserId={imageByUserId}
        />
      </div>
      <LastCommentBubble
        key={issue.id}
        issueId={issue.id}
        feedRef={feedRef}
        imageByUserId={imageByUserId}
      />
    </>
  );

  if (layout === 'page') {
    // From xl the issue content sits at the start edge and the actions with
    // Properties are fixed to the end edge (out of flow), so they never shift the
    // content; the end margin reserves their width so the two do not overlap.
    // Below xl there is no room for two columns, so the same two blocks are shown
    // inside the content column instead — the actions above the title, Properties
    // under the description.
    return (
      <>
        <div className="max-w-3xl xl:me-(--issue-properties-w)" style={propertiesWidthVar}>
          <div className="sticky top-0 z-10 -mt-6 bg-background/85 pt-6 pb-3 backdrop-blur-md xl:hidden">
            {actions}
          </div>
          {heading}
          <div className="xl:hidden">{renderProperties()}</div>
          {sections}
          {activity}
        </div>
        <aside
          className="hidden xl:fixed xl:end-6 xl:top-16 xl:block xl:w-(--issue-properties-w)"
          style={propertiesWidthVar}
        >
          {propertiesGrip}
          <div className="max-h-[calc(100vh-5.5rem)] overflow-y-auto">
            {actions}
            {sidebarProperties}
          </div>
        </aside>
      </>
    );
  }

  if (layout === 'split') {
    // Two columns in normal flow: content on the left, Properties as a right
    // sidebar. Unlike 'page' the sidebar is not viewport-fixed, so it stays inside
    // a narrower host (the inbox detail pane) without overlapping the content.
    // The breakpoint is the pane's own width, not the viewport's. The container
    // wraps the flex row rather than being it — an element cannot query itself.
    return (
      <div className="@container">
        <div className="flex gap-8">
          <div className="min-w-0 flex-1">
            <div className="@3xl:hidden">{actions}</div>
            {heading}
            <div className="@3xl:hidden">{renderProperties()}</div>
            {sections}
            {activity}
          </div>
          <aside
            className="relative hidden w-(--issue-properties-w) shrink-0 @3xl:block"
            style={propertiesWidthVar}
          >
            {propertiesGrip}
            {actions}
            {sidebarProperties}
          </aside>
        </div>
      </div>
    );
  }

  // The panel renders the actions in its header row (see IssueDetail), so the
  // panel body omits them. The wrapper is what the bubble sticks inside: without
  // it the bubble's parent would be the panel's scroll container, which bounds a
  // sticky child to the first screen of the scroll.
  return (
    <div>
      {heading}
      {renderProperties()}
      {sections}
      {activity}
    </div>
  );
}
