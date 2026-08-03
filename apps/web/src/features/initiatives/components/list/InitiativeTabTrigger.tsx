import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { InitiativesTab } from '@/utils/paths';
import { TabsTrigger } from '@/components/ui/tabs';
import InitiativeTabCount from './InitiativeTabCount';

// One tab of the initiatives list, draggable to reorder the strip. Selecting a tab
// is a click, not Radix's mouse-down activation: pressing a tab to drag it would
// navigate and unmount the drag context before the reorder lands. dnd-kit swallows
// the click a finished drag leaves behind.
//
// Of useSortable only the pointer listeners are taken: its keyboard listener would
// claim Space and Enter, which select the tab, and its accessibility attributes
// would override the tab role and the roving tabIndex Radix puts on the trigger.
// Keyboard stays with Radix, dragging is pointer-only.
export default function InitiativeTabTrigger({
  value,
  label,
  count,
  onSelect,
}: {
  value: InitiativesTab;
  label: string;
  count: number | undefined;
  onSelect: () => void;
}) {
  const { listeners, setNodeRef, transform, transition } = useSortable({ id: value });
  const { onKeyDown: _keyboardDrag, ...pointerListeners } = listeners ?? {};
  return (
    <TabsTrigger
      ref={setNodeRef}
      value={value}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="shrink-0 cursor-grab"
      {...pointerListeners}
      onClick={onSelect}
    >
      {label}
      <InitiativeTabCount value={count} />
    </TabsTrigger>
  );
}
