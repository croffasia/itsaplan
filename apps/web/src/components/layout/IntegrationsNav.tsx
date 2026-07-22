'use client';

import Link from 'next/link';
import { ChevronRight, Plug } from 'lucide-react';
import { godPath } from '@/utils/paths';
import { godIntegrationsIn, type GodGroup } from '@/utils/godSections';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';

// The integration sections of a group, folded into one collapsible item. It starts
// open when the current page is one of them, so a reload keeps the section visible.
export default function IntegrationsNav({
  group,
  pathname,
}: {
  group: GodGroup;
  pathname: string;
}) {
  const sections = godIntegrationsIn(group);
  if (sections.length === 0) return null;

  const isActive = (slug: string) => pathname.startsWith(`/god/${slug}`);
  const open = sections.some((s) => isActive(s.slug));

  return (
    <Collapsible defaultOpen={open} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip="Integrations">
            <Plug />
            <span>Integrations</span>
            <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {sections.map((section) => (
              <SidebarMenuSubItem key={section.slug}>
                <SidebarMenuSubButton asChild isActive={isActive(section.slug)}>
                  <Link href={godPath(section.slug)}>
                    <section.icon />
                    <span>{section.label}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
