import type { View } from '@/lib/api';
import { ViewIcon } from '@/utils/viewIcons';

// The saved-view label (icon + name), shown in the tab and in the drag overlay.
export default function ViewTabLabel({ view }: { view: View }) {
  return (
    <>
      <ViewIcon name={view.icon} className="size-3.5" />
      {view.name}
    </>
  );
}
