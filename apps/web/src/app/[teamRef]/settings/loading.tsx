import PageSkeleton from '@/components/common/skeleton/PageSkeleton';

// Stands in for a team's section while its route loads. It sits inside the team
// layout, so the two rails stay in place.
export default function Loading() {
  return <PageSkeleton />;
}
