import PublicDocumentPage from '@/features/documents/PublicDocumentPage';

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicDocumentPage token={token} />;
}
