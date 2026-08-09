import { Download, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AccountingPageState } from '../hooks/useAccountingPage';

export default function AccountingPageActions({
  state,
  canCreate,
}: {
  state: AccountingPageState;
  canCreate: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={state.year} onValueChange={state.setYear}>
        <SelectTrigger className="w-28 rounded-md" aria-label="Financial year">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {state.years.map((year) => (
            <SelectItem key={year} value={year}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        disabled={state.yearTransactions.length === 0}
        onClick={state.exportCsv}
      >
        <Download />
        Export CSV
      </Button>
      {canCreate && (
        <Button onClick={() => state.setCreating(true)}>
          <Plus />
          Add entry
        </Button>
      )}
    </div>
  );
}
