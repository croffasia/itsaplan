import RequireFeature from '@/components/common/permissions/RequireFeature';
import InitiativesRedirect from '@/features/initiatives/InitiativesRedirect';

// The list path carries no tab of its own; it redirects to one.
export default function Page() {
  return (
    <RequireFeature feature="initiatives">
      <InitiativesRedirect />
    </RequireFeature>
  );
}
