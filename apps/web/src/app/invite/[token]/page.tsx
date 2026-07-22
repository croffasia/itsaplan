'use client';

import { useParams } from 'next/navigation';
import InviteAcceptPage from '@/features/invite/InviteAcceptPage';

// The public invite accept route. The token is the only segment; the feature page
// loads the invite and drives the accept flow.
export default function Page() {
  const params = useParams();
  const token =
    typeof params.token === 'string'
      ? params.token
      : Array.isArray(params.token)
        ? params.token[0]
        : '';
  return <InviteAcceptPage token={token} />;
}
