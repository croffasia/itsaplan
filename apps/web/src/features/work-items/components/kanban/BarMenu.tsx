import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// A single dropdown action in the bulk-action bar: a ghost trigger button, a menu
// that opens upward (the bar sits at the bottom of the viewport).
export function BarMenu({
  icon,
  label,
  disabled,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2" disabled={disabled}>
          {icon}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="max-h-80 w-56 overflow-y-auto">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
