import { Star } from 'lucide-react';
import type { View } from '@/lib/api/endpoints/views';
import { ViewIcon } from '@/utils/viewIcons';

// The saved-view label (icon + name), shown in the tab and in the drag overlay. A
// favorite carries a star, the mark of the views also listed in the sidebar.
export default function ViewTabLabel({ view }: { view: View }) {
  return (
    <>
      <ViewIcon name={view.icon} className="size-3.5" />
      {view.name}
      {view.favorite && <Star className="size-3 fill-current text-amber-500" />}
    </>
  );
}
