import PublicIssuePage from '@/features/issue/PublicIssuePage';

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicIssuePage token={token} />;
}
