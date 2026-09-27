import PageSkeleton from '@/components/common/skeleton/PageSkeleton';

// The stand-in for every project route while its segment loads. It renders inside
// the Shell, so the sidebar and header stay put and only the body is replaced.
export default function Loading() {
  return <PageSkeleton />;
}
