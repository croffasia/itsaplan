import { Badge } from '@/components/ui/badge';
import { formatLeadStatus } from '../utils/leads';

export default function LeadsStatusBadge({ status }: { status: string | null }) {
  let variant: 'destructive' | 'secondary' | 'outline' = 'outline';
  if (status === 'failed' || status === 'reconciliation_required') variant = 'destructive';
  if (status === 'completed' || status === 'succeeded' || status === 'ready') {
    variant = 'secondary';
  }

  return <Badge variant={variant}>{formatLeadStatus(status)}</Badge>;
}
