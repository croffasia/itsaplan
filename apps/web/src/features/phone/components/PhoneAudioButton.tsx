'use client';

import { useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// Rinkel's audio urls need the API key, so the url is fetched through our API only
// when someone actually wants to listen. It is short-lived, which is why it is not
// loaded with the call list.
export default function PhoneAudioButton({
  label,
  loadUrl,
}: {
  label: string;
  loadUrl: () => Promise<string>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    try {
      setUrl(await loadUrl());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load the audio');
    } finally {
      setLoading(false);
    }
  }

  if (url) {
    return <audio controls autoPlay src={url} className="h-8 w-52" />;
  }

  return (
    <Button variant="ghost" size="sm" onClick={() => void open()} disabled={loading}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
      {label}
    </Button>
  );
}
