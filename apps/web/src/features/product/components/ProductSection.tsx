import type { ReactNode } from 'react';
import { Reveal } from '@/components/brand/infographics';

export default function ProductSection({
  id,
  title,
  intro,
  children,
  className,
}: {
  id: string;
  title: string;
  intro?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`px-6 py-20 sm:py-24 ${className ?? ''}`}
    >
      <Reveal className="mx-auto max-w-6xl">
        <h2
          id={`${id}-title`}
          className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          {title}
        </h2>
        {intro && <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{intro}</p>}
        <div className="mt-12">{children}</div>
      </Reveal>
    </section>
  );
}
