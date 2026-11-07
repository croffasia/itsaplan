'use client';

import { useState } from 'react';
import { Download, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type {
  TemplatePublisher,
  WorkspaceProjectTemplate,
} from '@/lib/api/endpoints/project-templates';
import { usePublishTemplate } from '@/services/projectTemplates.service';
import { Button } from '@/components/ui/button';
import WorkspaceTemplateGalleryPreview from './WorkspaceTemplateGalleryPreview';
import WorkspaceTemplatePublication from './WorkspaceTemplatePublication';
import WorkspaceTemplateUnpublishConfirm from './WorkspaceTemplateUnpublishConfirm';

// Publishes the template under the address's author, and once it is, shows its page.
export default function WorkspaceTemplatePublishForm({
  workspaceId,
  template,
  publisher,
  onChangeAuthor,
  onClose,
}: {
  workspaceId: number;
  template: WorkspaceProjectTemplate;
  publisher: TemplatePublisher;
  onChangeAuthor: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('teams.templates.publish');
  const tCommon = useTranslations('common');
  const [unpublishing, setUnpublishing] = useState(false);
  const publish = usePublishTemplate(workspaceId);
  const { publication } = template;

  function submit() {
    publish.mutate(template.id, {
      onSuccess: () => toast.success(t(publication ? 'updatedToast' : 'publishedToast')),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {publication ? (
        <WorkspaceTemplatePublication publication={publication} />
      ) : (
        <>
          <WorkspaceTemplateGalleryPreview
            workspaceId={workspaceId}
            template={template}
            publisher={publisher}
            onChangeAuthor={onChangeAuthor}
          />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Download className="size-3.5" />
              {t('downloadable')}
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="size-3.5" />
              {t('private')}
            </span>
          </div>
        </>
      )}

      {publication && unpublishing ? (
        <WorkspaceTemplateUnpublishConfirm
          workspaceId={workspaceId}
          templateId={template.id}
          onDone={() => setUnpublishing(false)}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {publication && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={publish.isPending}
              onClick={() => setUnpublishing(true)}
            >
              {t('unpublish')}
            </Button>
          )}
          <div className="ms-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              {tCommon(publication ? 'close' : 'cancel')}
            </Button>
            <Button disabled={publish.isPending} onClick={submit}>
              {t(publication ? 'update' : 'submit')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
