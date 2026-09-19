'use client';

import type { StudioLayout } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { StudioDraft } from '../hooks/useStudioComposer';
import { FIELD_LABELS } from '../utils/studio';

export default function StudioComposerFields({
  layout,
  draft,
  onChange,
}: {
  layout: StudioLayout;
  draft: StudioDraft;
  onChange: (key: keyof StudioDraft, value: string) => void;
}) {
  const labels = FIELD_LABELS[layout];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="composer-lead">{labels.lead}</Label>
        <Input
          id="composer-lead"
          value={draft.lead}
          onChange={(event) => onChange('lead', event.target.value)}
          placeholder="Your Rules. Your Money."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="composer-headline">{labels.headline}</Label>
        <Input
          id="composer-headline"
          value={draft.headline}
          onChange={(event) => onChange('headline', event.target.value)}
          placeholder="Our Platform."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="composer-subtext">{labels.subtext}</Label>
        <Textarea
          id="composer-subtext"
          rows={2}
          value={draft.subtext}
          onChange={(event) => onChange('subtext', event.target.value)}
        />
      </div>

      {layout === 'feature' && (
        <div className="space-y-2">
          <Label htmlFor="composer-chips">Pills</Label>
          <Input
            id="composer-chips"
            value={draft.chips}
            onChange={(event) => onChange('chips', event.target.value)}
            placeholder="Total transparency, Real control, No hidden limits"
          />
          <p className="text-xs text-muted-foreground">Up to three, separated by a comma.</p>
        </div>
      )}

      {layout === 'announcement' && (
        <div className="space-y-2">
          <Label htmlFor="composer-cta">Button</Label>
          <Input
            id="composer-cta"
            value={draft.ctaLabel}
            onChange={(event) => onChange('ctaLabel', event.target.value)}
            placeholder="Explore AI Support"
          />
          <p className="text-xs text-muted-foreground">
            The arrow is drawn for you. Leave empty to hide the button.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="composer-prompt">Image prompt</Label>
        <Textarea
          id="composer-prompt"
          rows={3}
          value={draft.imagePrompt}
          onChange={(event) => onChange('imagePrompt', event.target.value)}
          placeholder="A chrome padlock floating above concentric rings."
        />
        <p className="text-xs text-muted-foreground">
          Describe only the subject and the scene. The style comes from the template, and the text
          is drawn on top afterwards.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="composer-caption">Caption</Label>
        <Textarea
          id="composer-caption"
          rows={4}
          value={draft.caption}
          onChange={(event) => onChange('caption', event.target.value)}
          placeholder="The text you post alongside the image."
        />
      </div>
    </div>
  );
}
