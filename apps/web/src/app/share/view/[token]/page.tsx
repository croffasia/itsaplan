import PublicBoardPage from '@/features/work-items/PublicBoardPage';

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicBoardPage token={token} />;
}
