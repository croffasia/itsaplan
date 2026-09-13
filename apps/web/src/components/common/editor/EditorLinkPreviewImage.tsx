import { useState } from 'react';

export default function EditorLinkPreviewImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // Preview images are bounded raster data URLs returned by the API.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="aspect-[1.91] w-full rounded-xl bg-muted object-cover outline -outline-offset-1 outline-black/10 dark:outline-white/10"
    />
  );
}
