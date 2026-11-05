'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

// God writes the layout, and it reaches the page as a whole HTML document, so it stays in a
// frame of its own: its styles cannot touch the page. The sandbox has no scripts, and keeps
// the frame's origin only for reading the height of the email.
export default function GodEmailFrame({ html }: { html: string }) {
  const t = useTranslations('god.emailTemplates');
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(420);

  return (
    <iframe
      ref={frame}
      title={t('preview')}
      sandbox="allow-same-origin"
      srcDoc={html}
      style={{ height }}
      className="w-full border-0"
      onLoad={() => {
        const scrollHeight = frame.current?.contentDocument?.documentElement.scrollHeight;
        if (scrollHeight) setHeight(scrollHeight);
      }}
    />
  );
}
