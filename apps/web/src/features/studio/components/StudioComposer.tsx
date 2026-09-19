'use client';

import { ImagePlus, Sparkles } from 'lucide-react';
import type { StudioPost, StudioTemplate } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useStudioComposer } from '../hooks/useStudioComposer';
import { useStudioPhoto } from '../hooks/useStudioPhoto';
import StudioComposerFields from './StudioComposerFields';
import StudioPreview from './StudioPreview';

export default function StudioComposer({
  projectKey,
  post,
  template,
  canEdit,
}: {
  projectKey: string;
  post: StudioPost;
  template: StudioTemplate;
  canEdit: boolean;
}) {
  const composer = useStudioComposer(projectKey, post);
  const photo = useStudioPhoto(post.sourceImageId);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={composer.writeCopy}
            disabled={!canEdit || composer.writingCopy || !template.textModel}
          >
            <Sparkles className="size-4" />
            {composer.writingCopy ? 'Writing…' : 'Write with AI'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void composer.makePhoto()}
            disabled={!canEdit || composer.makingPhoto || composer.draft.imagePrompt.trim() === ''}
          >
            <ImagePlus className="size-4" />
            {composer.makingPhoto ? 'Generating…' : 'Generate photo'}
          </Button>
          <Button
            size="sm"
            onClick={composer.save}
            disabled={!canEdit || !composer.dirty || composer.saving}
          >
            {composer.saving ? 'Saving…' : 'Save text'}
          </Button>
        </div>

        {!template.textModel && (
          <p className="rounded-md border border-dashed p-2.5 text-xs text-muted-foreground">
            This template has no text model, so the headline, subtext and caption are written by
            hand.
          </p>
        )}

        <StudioComposerFields
          layout={template.layout}
          draft={composer.draft}
          onChange={composer.setField}
        />
      </div>

      <div className="space-y-2">
        <StudioPreview
          template={template}
          lead={composer.draft.lead}
          headline={composer.draft.headline}
          subtext={composer.draft.subtext}
          chips={composer.draft.chips}
          ctaLabel={composer.draft.ctaLabel}
          photo={photo}
          saving={composer.savingRendered}
          onSave={composer.saveRendered}
        />
        <p className="text-xs text-muted-foreground">
          Saved into the vault folder <span className="font-medium">{post.folder}</span>.
        </p>
      </div>
    </div>
  );
}
