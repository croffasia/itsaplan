'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './infographics.module.css';

// The server renders the content visible, so it stays readable without
// JavaScript; the hidden state is only set for content still below the fold.
export default function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'idle' | 'hidden' | 'shown'>('idle');

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState('shown');
          observer.disconnect();
        } else {
          setState((s) => (s === 'idle' ? 'hidden' : s));
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-reveal={state} className={`${styles.reveal} ${className ?? ''}`}>
      {children}
    </div>
  );
}
