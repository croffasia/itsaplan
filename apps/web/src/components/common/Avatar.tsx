'use client';

import { forwardRef, useState, type ComponentProps } from 'react';
import { avatarColor, initials } from '@/utils/avatar';
import { resolveApiUrl } from '@/lib/api';
import { cn } from '@/lib/utils';

// A person's avatar. With an uploaded `image` it shows that picture; otherwise
// (or if the image fails to load) it falls back to a colored circle with their
// initials, deterministic per name (same name → same color, see
// avatarColor/initials in lib/avatar). The default size matches the issue-card
// avatar; pass a size-* / text-* className to scale it (comments use a larger
// one). forwardRef + spread so it works as a Radix Tooltip/Popover `asChild`
// trigger.
const Avatar = forwardRef<
  HTMLSpanElement,
  ComponentProps<'span'> & { name: string; image?: string | null }
>(({ name, image, className, ...props }, ref) => {
  // The url that failed to load, not a flag: the same mounted Avatar is reused for a
  // different person (a select trigger) or gets a freshly uploaded picture, and both
  // must try the new url again.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(image) && failedSrc !== image;

  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full text-[9px] font-semibold text-white',
        className,
      )}
      {...props}
      style={{
        backgroundColor: showImage ? undefined : avatarColor(initials(name)),
        ...props.style,
      }}
    >
      {showImage ? (
        <img
          src={resolveApiUrl(image!)}
          alt={name}
          draggable={false}
          className="size-full object-cover"
          onError={() => setFailedSrc(image!)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
});
Avatar.displayName = 'Avatar';

export default Avatar;
