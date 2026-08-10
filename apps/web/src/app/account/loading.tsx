import PageSkeleton from '@/components/common/skeleton/PageSkeleton';

// The stand-in for the account routes, which render outside the app shell. It repeats
// FullPageView's chrome — the top bar and the centered column — so the bar does not
// appear only once the page has loaded.
export default function Loading() {
  return (
    <div className="min-h-svh bg-background">
      <div className="h-12 border-b" />
      <PageSkeleton className="max-w-3xl" />
    </div>
  );
}
