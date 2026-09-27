import RequireFeature from '@/components/common/permissions/RequireFeature';
import DocumentsPage from '@/features/documents/DocumentsPage';

export default function Page() {
  return (
    <RequireFeature feature="documents">
      <DocumentsPage />
    </RequireFeature>
  );
}
