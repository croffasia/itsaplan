'use client';

import { usePathname } from 'next/navigation';
import { ArrowLeft, Shield } from 'lucide-react';
import { godPath } from '@/utils/paths';
import { GOD_GROUPS, godSectionsIn } from '@/utils/godSections';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import IntegrationsNav from '@/components/layout/IntegrationsNav';
import SidebarNavItem from '@/components/layout/SidebarNavItem';
import SidebarBrandFooter from '@/components/brand/SidebarBrandFooter';

// The sidebar in god mode. It mirrors the project settings sidebar — a list of
// sections plus a way back, with the integration sections folded into a collapsible
// item — but the header shows a static "God mode" badge instead of the project
// switcher: nothing here is scoped to a project.
export default function GodSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent" asChild>
              <div>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Shield className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">God mode</span>
                  <span className="truncate text-xs text-muted-foreground">Instance settings</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarNavItem
                href="/"
                icon={ArrowLeft}
                label="Back to app"
                active={false}
                disabled={false}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {GOD_GROUPS.map((group) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel>{group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {godSectionsIn(group).map((section) => (
                  <SidebarNavItem
                    key={section.slug}
                    href={godPath(section.slug)}
                    icon={section.icon}
                    label={section.label}
                    active={pathname.startsWith(`/god/${section.slug}`)}
                    disabled={false}
                  />
                ))}
                <IntegrationsNav group={group} pathname={pathname} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarBrandFooter />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
