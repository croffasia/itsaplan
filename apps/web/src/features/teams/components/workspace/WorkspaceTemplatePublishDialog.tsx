'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceProjectTemplate } from '@/lib/api/endpoints/project-templates';
import { useSession } from '@/lib/auth-client';
import {
  useTemplatePublisherQuery,
  useUnlinkTemplatePublisher,
} from '@/services/projectTemplates.service';
import Modal from '@/components/common/overlay/Modal';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import WorkspaceTemplatePublishForm from './WorkspaceTemplatePublishForm';
import WorkspaceTemplatePublisherAuthor from './WorkspaceTemplatePublisherAuthor';
import WorkspaceTemplatePublisherLink from './WorkspaceTemplatePublisherLink';
import WorkspaceTemplatePublisherMenu from './WorkspaceTemplatePublisherMenu';

// Publishes a template to the gallery at itsaplan.dev. A workspace not linked to the
// gallery yet confirms an email first, and an address with no author names one.
export default function WorkspaceTemplatePublishDialog({
  workspaceId,
  template,
  onClose,
}: {
  workspaceId: number;
  template: WorkspaceProjectTemplate;
  onClose: () => void;
}) {
  const t = useTranslations('teams.templates.publish');
  const { data: session } = useSession();
  const publisher = useTemplatePublisherQuery(workspaceId);
  const unlink = useUnlinkTemplatePublisher(workspaceId);
  const [relinking, setRelinking] = useState(false);
  const [naming, setNaming] = useState(false);
  const linked = publisher.data && !relinking ? publisher.data : null;
  const askAuthor = naming || !linked?.authorName;

  return (
    <Modal
      title={t('action')}
      crumb={template.name}
      controls={
        linked && (
          <WorkspaceTemplatePublisherMenu
            publisher={linked}
            onChangeAuthor={() => setNaming(true)}
            onChangeEmail={() => {
              setNaming(false);
              setRelinking(true);
            }}
            onUnlink={() => unlink.mutate()}
          />
        )
      }
      onClose={onClose}
    >
      {publisher.isPending && <ListSkeleton rows={3} rowClassName="h-9" />}
      {publisher.isSuccess && !linked && (
        <WorkspaceTemplatePublisherLink
          workspaceId={workspaceId}
          defaultEmail={publisher.data?.email ?? session?.user.email ?? ''}
          onLinked={() => setRelinking(false)}
          onCancel={relinking ? () => setRelinking(false) : onClose}
        />
      )}
      {linked && askAuthor && (
        <WorkspaceTemplatePublisherAuthor
          workspaceId={workspaceId}
          publisher={linked}
          defaultName={session?.user.name ?? ''}
          onDone={() => setNaming(false)}
        />
      )}
      {linked && !askAuthor && (
        <WorkspaceTemplatePublishForm
          workspaceId={workspaceId}
          template={template}
          publisher={linked}
          onChangeAuthor={() => setNaming(true)}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}
