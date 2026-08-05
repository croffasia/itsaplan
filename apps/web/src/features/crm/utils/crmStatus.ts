import type { CrmCustomerStatus } from '@/lib/api';

export const CRM_STATUS_LABELS: Record<CrmCustomerStatus, string> = {
  prospect: 'Prospect',
  active: 'Active',
  inactive: 'Inactive',
};

export const CRM_STATUS_CLASSES: Record<CrmCustomerStatus, string> = {
  prospect: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  active: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  inactive: 'border-border bg-muted text-muted-foreground',
};
