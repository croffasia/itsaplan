import { Search } from 'lucide-react';
import type { FinancePaymentStatus, FinanceTransactionType } from '@/lib/api';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type AccountingTypeFilter = FinanceTransactionType | 'all';
export type AccountingStatusFilter = FinancePaymentStatus | 'all';

export default function AccountingEntriesHeader({
  count,
  search,
  type,
  status,
  onSearchChange,
  onTypeChange,
  onStatusChange,
}: {
  count: number;
  search: string;
  type: AccountingTypeFilter;
  status: AccountingStatusFilter;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: AccountingTypeFilter) => void;
  onStatusChange: (value: AccountingStatusFilter) => void;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-end">
      <div>
        <h2 className="font-semibold">Bookkeeping entries</h2>
        <p className="text-sm text-muted-foreground">{count} entries in this financial year</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            type="search"
            className="pl-9"
            placeholder="Search entries…"
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <Select value={type} onValueChange={(value) => onTypeChange(value as AccountingTypeFilter)}>
          <SelectTrigger className="w-full rounded-md sm:w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="income">Sales</SelectItem>
            <SelectItem value="expense">Purchases</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => onStatusChange(value as AccountingStatusFilter)}
        >
          <SelectTrigger className="w-full rounded-md sm:w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
