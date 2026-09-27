import { redirect } from 'next/navigation';

// The path team settings had before they moved under the team. The id is a valid
// team ref, and the settings page moves it on to the slug.
export default async function Page({
  params,
}: {
  params: Promise<{ teamId: string; section?: string[] }>;
}) {
  const { teamId, section = [] } = await params;
  redirect(['', teamId, 'settings', ...section].map(encodeURIComponent).join('/'));
}
