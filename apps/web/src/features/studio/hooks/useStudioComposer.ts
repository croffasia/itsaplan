import { useEffect, useState } from 'react';
import type { StudioPost, StudioPostPatch } from '@/lib/api';
import {
  useGenerateStudioCopy,
  useGenerateStudioImage,
  useSaveRenderedPost,
  useUpdateStudioPost,
} from '../services/studio.service';
import { parseChips } from '../utils/studio';

export interface StudioDraft {
  lead: string;
  headline: string;
  subtext: string;
  // Held as the comma-separated text the field shows; split on save.
  chips: string;
  ctaLabel: string;
  caption: string;
  imagePrompt: string;
}

function draftOf(post: StudioPost): StudioDraft {
  return {
    lead: post.lead,
    headline: post.headline,
    subtext: post.subtext,
    chips: post.chips.join(', '),
    ctaLabel: post.ctaLabel,
    caption: post.caption,
    imagePrompt: post.imagePrompt,
  };
}

function patchOf(draft: StudioDraft): StudioPostPatch {
  return { ...draft, chips: parseChips(draft.chips) };
}

// The editable state of the selected post. The generation calls write straight to
// the post, so the draft is re-seeded whenever the stored post changes.
export function useStudioComposer(projectKey: string, post: StudioPost) {
  const [draft, setDraft] = useState<StudioDraft>(() => draftOf(post));
  const update = useUpdateStudioPost(projectKey);
  const generateCopy = useGenerateStudioCopy(projectKey);
  const generateImage = useGenerateStudioImage(projectKey);
  const saveRendered = useSaveRenderedPost(projectKey);

  // Keyed on the stored post rather than its object identity: a background
  // refetch hands back an equal post, and re-seeding on that would throw away
  // whatever is being typed.
  useEffect(() => {
    setDraft(draftOf(post));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, post.updatedAt]);

  const stored = draftOf(post);
  const dirty = (Object.keys(draft) as (keyof StudioDraft)[]).some(
    (key) => draft[key] !== stored[key],
  );

  return {
    draft,
    dirty,
    setField: (key: keyof StudioDraft, value: string) =>
      setDraft((current) => ({ ...current, [key]: value })),
    save: () => update.mutate({ postId: post.id, patch: patchOf(draft) }),
    saving: update.isPending,
    writeCopy: () => generateCopy.mutate(post.id),
    writingCopy: generateCopy.isPending,
    // The prompt has to be stored before the photo is generated, because the API
    // reads it from the post rather than from the request.
    makePhoto: async () => {
      if (dirty) await update.mutateAsync({ postId: post.id, patch: patchOf(draft) });
      generateImage.mutate(post.id);
    },
    makingPhoto: generateImage.isPending || update.isPending,
    saveRendered: (blob: Blob) => saveRendered.mutate({ postId: post.id, blob }),
    savingRendered: saveRendered.isPending,
  };
}
