import RequireFeature from '@/components/common/permissions/RequireFeature';
import CyclesRedirect from '@/features/cycles/CyclesRedirect';

// The list path carries no layout of its own; it redirects to one.
export default function Page() {
  return (
    <RequireFeature feature="cycles">
      <CyclesRedirect />
    </RequireFeature>
  );
}
