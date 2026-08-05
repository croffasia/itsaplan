import type { CrmCustomerStatus } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { CRM_STATUS_CLASSES, CRM_STATUS_LABELS } from '../utils/crmStatus';

export default function CrmStatusBadge({ status }: { status: CrmCustomerStatus }) {
  return (
    <Badge variant="outline" className={CRM_STATUS_CLASSES[status]}>
      {CRM_STATUS_LABELS[status]}
    </Badge>
  );
}
