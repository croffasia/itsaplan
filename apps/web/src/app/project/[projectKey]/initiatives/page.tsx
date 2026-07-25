import RequireFeature from '@/components/common/permissions/RequireFeature';
import InitiativesPage from '@/features/initiatives/InitiativesPage';

export default function Page() {
  return (
    <RequireFeature feature="initiatives">
      <InitiativesPage />
    </RequireFeature>
  );
}
