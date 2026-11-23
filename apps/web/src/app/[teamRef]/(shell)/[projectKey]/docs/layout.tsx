import type { ReactNode } from 'react';
import RequireFeature from '@/components/common/permissions/RequireFeature';
import DocumentsPage from '@/features/documents/DocumentsPage';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RequireFeature feature="documents">
      <DocumentsPage>{children}</DocumentsPage>
    </RequireFeature>
  );
}
