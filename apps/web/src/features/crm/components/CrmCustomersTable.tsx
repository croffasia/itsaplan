import type { CrmCustomer } from '@/lib/api';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import CrmCustomerRow from './CrmCustomerRow';

export default function CrmCustomersTable({
  customers,
  projectKey,
}: {
  customers: CrmCustomer[];
  projectKey: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table className="min-w-[920px] table-fixed">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[12%]" />
          <col className="w-[16%]" />
          <col className="w-[14%]" />
          <col className="w-[24%]" />
          <col className="w-[12%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-3 text-xs text-muted-foreground">Company</TableHead>
            <TableHead className="px-3 text-xs text-muted-foreground">Status</TableHead>
            <TableHead className="px-3 text-xs text-muted-foreground">Service</TableHead>
            <TableHead className="px-3 text-xs text-muted-foreground">Owner</TableHead>
            <TableHead className="px-3 text-xs text-muted-foreground">Next action</TableHead>
            <TableHead className="px-3 text-xs text-muted-foreground">Deadline</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <CrmCustomerRow key={customer.id} customer={customer} projectKey={projectKey} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
