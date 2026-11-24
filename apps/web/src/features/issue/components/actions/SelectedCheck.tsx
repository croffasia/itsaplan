import { Check } from 'lucide-react';

// Trailing check on the currently-selected row in a single-select submenu.
export default function SelectedCheck({ selected }: { selected: boolean }) {
  return selected ? <Check className="ml-auto size-4" /> : null;
}
