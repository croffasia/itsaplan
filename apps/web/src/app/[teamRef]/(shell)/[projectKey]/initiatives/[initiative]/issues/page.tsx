import { notFound } from 'next/navigation';
import RequireFeature from '@/components/common/permissions/RequireFeature';
import InitiativeDetailPage from '@/features/initiatives/InitiativeDetailPage';

export default async function Page({ params }: { params: Promise<{ initiative: string }> }) {
  const id = Number((await params).initiative);
  if (!Number.isInteger(id) || id <= 0) notFound();

  return (
    <RequireFeature feature="initiatives">
      <InitiativeDetailPage initiativeId={id} tab="issues" />
    </RequireFeature>
  );
}
