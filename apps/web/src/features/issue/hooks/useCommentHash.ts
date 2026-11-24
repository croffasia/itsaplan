import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const ANCHORED_KEY = '__itsaplanCommentAnchor';

function hashCommentId(): number | null {
  const match = /^#comment-([1-9]\d{0,9})$/.exec(window.location.hash);
  return match ? Number(match[1]) : null;
}

// The comment the address points at (/acme/issue/MKT-42#comment-7), or null. The hash is
// read after each navigation: the issue page stays mounted from one issue to the next,
// and Next writes the new address after it renders. A comment already brought into view
// in this history entry gives null, so a reload or Back keeps the reader's own scroll
// position, as a browser does for a fragment it has followed.
export function useCommentHash(): number | null {
  const pathname = usePathname();
  const [read, setRead] = useState<{ pathname: string; commentId: number | null } | null>(null);

  useEffect(() => {
    const readHash = () => {
      const commentId = hashCommentId();
      const anchored = commentId != null && window.history.state?.[ANCHORED_KEY] === commentId;
      setRead({ pathname, commentId: anchored ? null : commentId });
    };
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, [pathname]);

  // Read for the previous issue until the effect runs for this one.
  return read?.pathname === pathname ? read.commentId : null;
}

// Records on the history entry that its comment has been brought into view. The spread
// keeps the state Next and the scroll restoration store there. A target without a hash
// (the inbox) leaves the entry alone.
export function markCommentAnchored(commentId: number) {
  if (hashCommentId() !== commentId) return;
  window.history.replaceState(
    { ...window.history.state, [ANCHORED_KEY]: commentId },
    '',
    window.location.href,
  );
}
