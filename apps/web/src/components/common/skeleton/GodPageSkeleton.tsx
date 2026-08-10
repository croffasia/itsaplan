import { cn } from '@/lib/utils';
import { GOD_COLUMN_CLASS } from '@/utils/godSections';
import PageSkeleton from './PageSkeleton';

// Stands in for a god page: the column and padding GodSectionPage renders its
// sections in, so the loaded section lands where the skeleton was.
export default function GodPageSkeleton() {
  return <PageSkeleton className={cn('mx-0 px-4 pt-5 pb-4 sm:px-6 lg:px-8', GOD_COLUMN_CLASS)} />;
}
