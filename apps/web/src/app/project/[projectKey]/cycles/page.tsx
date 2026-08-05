import RequireFeature from '@/components/common/permissions/RequireFeature';
import CyclesPage from '@/features/cycles/CyclesPage';

export default function Page() {
  return (
    <RequireFeature feature="cycles">
      <CyclesPage />
    </RequireFeature>
  );
}
