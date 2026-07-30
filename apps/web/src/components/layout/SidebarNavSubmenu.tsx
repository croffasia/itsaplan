'use client';

import type { LucideIcon } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import SidebarNavSubmenuCollapsible from '@/components/layout/SidebarNavSubmenuCollapsible';
import SidebarNavSubmenuMenu from '@/components/layout/SidebarNavSubmenuMenu';

export type SidebarNavSubmenuItem = {
  key: string;
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
};

// A sidebar item holding a sub-list of links. Collapsed to icons there is no room
// for a sub-list, so it becomes a dropdown; the mobile sidebar is a sheet at full
// width, never icon-sized.
export default function SidebarNavSubmenu({
  icon,
  label,
  items,
}: {
  icon: LucideIcon;
  label: string;
  items: SidebarNavSubmenuItem[];
}) {
  const { state, isMobile } = useSidebar();

  if (state === 'collapsed' && !isMobile)
    return <SidebarNavSubmenuMenu icon={icon} label={label} items={items} />;

  return <SidebarNavSubmenuCollapsible icon={icon} label={label} items={items} />;
}
