'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Save } from 'lucide-react';
import type { StudioTemplate } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { canvasToBlob, renderPost } from '../utils/renderPost';
import { parseChips } from '../utils/studio';

// The post as it will be published. The canvas is drawn at full export size and
// scaled down by CSS, so what is shown and what is saved are the same pixels.
export default function StudioPreview({
  template,
  lead,
  headline,
  subtext,
  chips,
  ctaLabel,
  photo,
  saving,
  onSave,
}: {
  template: StudioTemplate;
  lead: string;
  headline: string;
  subtext: string;
  chips: string;
  ctaLabel: string;
  photo: HTMLImageElement | null;
  saving: boolean;
  onSave: (blob: Blob) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The first paint can land before the web font is ready, which would measure
  // and wrap the text against a fallback. A second paint follows once it loads.
  const [fontsReady, setFontsReady] = useState(false);
  const chipList = useMemo(() => parseChips(chips), [chips]);

  useEffect(() => {
    void document.fonts.ready.then(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      renderPost(canvas, { template, lead, headline, subtext, chips: chipList, ctaLabel, photo });
    }
  }, [template, lead, headline, subtext, chipList, ctaLabel, photo, fontsReady]);

  async function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = URL.createObjectURL(await canvasToBlob(canvas));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'post.png';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    // Revoking in the same task cancels the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function save() {
    const canvas = canvasRef.current;
    if (canvas) onSave(await canvasToBlob(canvas));
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg border bg-muted"
        aria-label="Post preview"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="size-4" />
          {saving ? 'Saving…' : 'Save to vault'}
        </Button>
        <Button size="sm" variant="outline" onClick={download}>
          <Download className="size-4" />
          Download
        </Button>
      </div>
    </div>
  );
}
