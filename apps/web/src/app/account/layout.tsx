import type { ReactNode } from 'react';
import AccountTitle from '@/features/account/components/AccountTitle';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <AccountTitle />
      {children}
    </>
  );
}
