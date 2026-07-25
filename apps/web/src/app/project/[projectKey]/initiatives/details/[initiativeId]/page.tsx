import RequireFeature from '@/components/common/permissions/RequireFeature';
import InitiativeDetailPage from '@/features/initiatives/InitiativeDetailPage';

export default function Page() {
  return (
    <RequireFeature feature="initiatives">
      <InitiativeDetailPage tab="overview" />
    </RequireFeature>
  );
}
