import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';

// A single sidebar link. Disabled (no target) until a project is selected.
export default function SidebarNavItem({
  href,
  icon: Icon,
  label,
  active,
  disabled,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  disabled: boolean;
  badge?: number;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} disabled={disabled} tooltip={label}>
        <Link href={disabled ? '#' : href}>
          <Icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
      {badge != null && badge > 0 && <SidebarMenuBadge>{badge}</SidebarMenuBadge>}
    </SidebarMenuItem>
  );
}
