import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import type { SidebarNavSubmenuItem } from '@/components/layout/SidebarNavSubmenu';

// The icon-collapsed form of SidebarNavSubmenu: the items fly out to the side.
export default function SidebarNavSubmenuMenu({
  icon: Icon,
  label,
  items,
}: {
  icon: LucideIcon;
  label: string;
  items: SidebarNavSubmenuItem[];
}) {
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton tooltip={label} isActive={items.some((i) => i.active)}>
            <Icon />
            <span>{label}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-48 rounded-lg" align="start" side="right">
          <DropdownMenuLabel className="text-xs text-muted-foreground">{label}</DropdownMenuLabel>
          {items.map((item) => (
            <DropdownMenuItem key={item.key} asChild className="gap-2">
              <Link href={item.href}>
                <item.icon />
                <span>{item.label}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
