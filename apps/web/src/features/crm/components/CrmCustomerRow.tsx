import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import type { CrmCustomer } from '@/lib/api';
import { crmCustomerPath } from '@/utils/paths';
import { formatShortDate, isOverdue } from '@/utils/dates';
import { cn } from '@/lib/utils';
import { TableCell, TableRow } from '@/components/ui/table';
import CrmStatusBadge from './CrmStatusBadge';

export default function CrmCustomerRow({
  customer,
  projectKey,
}: {
  customer: CrmCustomer;
  projectKey: string;
}) {
  const router = useRouter();
  const href = crmCustomerPath(projectKey, customer.id);

  return (
    <TableRow className="group/item cursor-pointer" onClick={() => router.push(href)}>
      <TableCell className="px-3 py-3 whitespace-normal">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Building2 className="size-4" />
          </span>
          <Link
            href={href}
            className="truncate font-medium hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {customer.name}
          </Link>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3">
        <CrmStatusBadge status={customer.status} />
      </TableCell>
      <TableCell className="px-3 py-3 text-muted-foreground">{customer.service || '—'}</TableCell>
      <TableCell className="px-3 py-3 text-muted-foreground">{customer.owner || '—'}</TableCell>
      <TableCell className="px-3 py-3 whitespace-normal text-muted-foreground">
        <span className="line-clamp-2">{customer.nextAction || '—'}</span>
      </TableCell>
      <TableCell
        className={cn(
          'px-3 py-3 text-muted-foreground',
          isOverdue(customer.deadline) && 'font-medium text-destructive',
        )}
      >
        {customer.deadline ? formatShortDate(customer.deadline) : '—'}
      </TableCell>
    </TableRow>
  );
}
