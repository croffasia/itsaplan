import type { ReactNode } from 'react';
import AppWordmark from '@/components/common/AppWordmark';
import OrbitMark from './OrbitMark';

export default function SystemScreen({
  code,
  title,
  description,
  children,
}: {
  code?: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background px-6 py-12 text-center">
      <AppWordmark className="h-10 w-auto text-primary" />
      <OrbitMark className="w-40" />
      <div className="flex max-w-md flex-col gap-2">
        {code && <p className="font-mono text-sm tracking-[0.3em] text-muted-foreground">{code}</p>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">{children}</div>
    </main>
  );
}
