import RequireFeature from '@/components/common/permissions/RequireFeature';
import DashboardsPage from '@/features/dashboards/DashboardsPage';

export default function Page() {
  return (
    <RequireFeature feature="dashboards">
      <DashboardsPage />
    </RequireFeature>
  );
}
