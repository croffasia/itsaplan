import { Suspense } from 'react';
import type { ReactNode } from 'react';
import BrandPanel from '@/components/common/page/BrandPanel';
import AuthLegalNotice from './AuthLegalNotice';

// The full-screen layout shared by every logged-out screen. The forms read the URL
// (an invite parameter, a reset token, a "just confirmed" flag), so they render
// inside a Suspense boundary — useSearchParams needs one for these pages to prerender.
export default function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh bg-card md:grid-cols-2">
      <div className="flex flex-col items-center justify-center gap-4 p-6 md:p-10">
        <div className="w-full max-w-md">
          <Suspense fallback={null}>{children}</Suspense>
        </div>
        <AuthLegalNotice />
      </div>
      <BrandPanel />
    </div>
  );
}
