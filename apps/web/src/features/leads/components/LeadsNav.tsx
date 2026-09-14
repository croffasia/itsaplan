'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Building2, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { leadsAgentRunsPath, leadsApprovalInboxPath, leadsPath } from '@/utils/paths';

export default function LeadsNav({ projectKey }: { projectKey: string }) {
  const pathname = usePathname();
  const items = [
    { label: 'Campaigns', href: leadsPath(projectKey), icon: Building2 },
    { label: 'Approval Inbox', href: leadsApprovalInboxPath(projectKey), icon: Inbox },
    { label: 'Agent Runs', href: leadsAgentRunsPath(projectKey), icon: Activity },
  ];

  return (
    <nav className="mb-6 flex gap-2 overflow-x-auto" aria-label="Leads">
      {items.map((item) => (
        <Button
          key={item.href}
          asChild
          size="sm"
          variant={pathname === item.href ? 'secondary' : 'ghost'}
        >
          <Link href={item.href}>
            <item.icon />
            {item.label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
