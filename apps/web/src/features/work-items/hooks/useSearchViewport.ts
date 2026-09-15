import { useEffect, useState } from 'react';

export function useSearchViewport() {
  const [viewport, setViewport] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const source = window.visualViewport;
    const update = () =>
      setViewport({ top: source?.offsetTop ?? 0, height: source?.height ?? window.innerHeight });
    update();
    source?.addEventListener('resize', update);
    source?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      source?.removeEventListener('resize', update);
      source?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return viewport;
}
