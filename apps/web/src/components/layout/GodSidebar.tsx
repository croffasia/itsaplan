'use client';

import { usePathname } from 'next/navigation';
import { ArrowLeft, Plug, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { godPath } from '@/utils/paths';
import { GOD_GROUPS, godIntegrationsIn, godSectionsIn } from '@/utils/godSections';
import { useGodSectionText } from '@/hooks/useSectionLabels';
import { useSidebarSide } from '@/hooks/useSidebarSide';
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
import SidebarNavItem from '@/components/layout/SidebarNavItem';
import SidebarNavSubmenu from '@/components/layout/SidebarNavSubmenu';
import SidebarBrandFooter from '@/components/brand/SidebarBrandFooter';

// The sidebar in god mode. It mirrors the project settings sidebar — a list of
// sections plus a way back, with the integration sections folded into one item —
// but the header shows a static "God mode" badge instead of the project switcher:
// nothing here is scoped to a project.
export default function GodSidebar() {
  const t = useTranslations('nav');
  const god = useGodSectionText();
  const pathname = usePathname();
  const side = useSidebarSide();

  return (
    <Sidebar collapsible="icon" side={side}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent" asChild>
              <div>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Shield className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">{t('godMode')}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t('instanceSettings')}
                  </span>
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
                label={t('backToApp')}
                active={false}
                disabled={false}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {GOD_GROUPS.map((group) => {
          const integrations = godIntegrationsIn(group).map((section) => ({
            key: section.slug,
            href: godPath(section.slug),
            icon: section.icon,
            label: god.section(section.slug).label,
            active: pathname.startsWith(`/god/${section.slug}`),
          }));
          return (
            <SidebarGroup key={group}>
              <SidebarGroupLabel>{god.group(group)}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {godSectionsIn(group).map((section) => (
                    <SidebarNavItem
                      key={section.slug}
                      href={godPath(section.slug)}
                      icon={section.icon}
                      label={god.section(section.slug).label}
                      active={pathname.startsWith(`/god/${section.slug}`)}
                      disabled={false}
                    />
                  ))}
                  {integrations.length > 0 && (
                    <SidebarNavSubmenu icon={Plug} label={t('integrations')} items={integrations} />
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarBrandFooter />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
