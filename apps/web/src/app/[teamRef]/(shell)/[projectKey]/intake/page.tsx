import RequireFeature from '@/components/common/permissions/RequireFeature';
import IntakePage from '@/features/intake/IntakePage';

export default function Page() {
  return (
    <RequireFeature feature="intake">
      <IntakePage />
    </RequireFeature>
  );
}
