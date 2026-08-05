import {
  BriefcaseBusiness,
  CheckSquare2,
  Contact,
  Files,
  Flag,
  MessageSquareText,
  NotebookPen,
  PhoneCall,
} from 'lucide-react';
import type { CrmCustomer } from '@/lib/api';
import { formatDate } from '@/utils/dates';
import { usePermissions } from '@/hooks/usePermissions';
import CrmDetailCard from './CrmDetailCard';
import CrmFilesCard from './CrmFilesCard';

export default function CrmCustomerDetails({
  customer,
  projectKey,
}: {
  customer: CrmCustomer;
  projectKey: string;
}) {
  const { can } = usePermissions();
  const tasks = customer.openTasks
    .split('\n')
    .map((task) => task.trim().replace(/^[-•]\s*/, ''))
    .filter(Boolean);

  return (
    <div className="grid gap-4 pb-8 lg:grid-cols-2">
      <CrmDetailCard title="Contact details" icon={Contact}>
        <dl className="space-y-2">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Contact</dt>
            <dd className="text-right font-medium">{customer.contactName || '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="min-w-0 truncate text-right">
              {customer.contactEmail ? (
                <a className="font-medium hover:underline" href={`mailto:${customer.contactEmail}`}>
                  {customer.contactEmail}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Phone</dt>
            <dd className="text-right">
              {customer.contactPhone ? (
                <a className="font-medium hover:underline" href={`tel:${customer.contactPhone}`}>
                  {customer.contactPhone}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
        </dl>
      </CrmDetailCard>

      <CrmDetailCard title="Sold service" icon={BriefcaseBusiness}>
        <p className="whitespace-pre-wrap">{customer.service || 'No service recorded.'}</p>
      </CrmDetailCard>

      <CrmDetailCard title="Project status" icon={Flag}>
        <p className="whitespace-pre-wrap">
          {customer.projectStatus || 'No project status recorded.'}
        </p>
      </CrmDetailCard>

      <CrmDetailCard title="Open tasks" icon={CheckSquare2}>
        {tasks.length > 0 ? (
          <ul className="space-y-2">
            {tasks.map((task, index) => (
              <li key={`${task}-${index}`} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                <span>{task}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No open tasks.</p>
        )}
      </CrmDetailCard>

      <CrmDetailCard title="Notes" icon={NotebookPen} className="lg:col-span-2">
        <p className="whitespace-pre-wrap text-muted-foreground">
          {customer.notes || 'No notes recorded.'}
        </p>
      </CrmDetailCard>

      {can('files', 'read') ? (
        <CrmFilesCard
          projectKey={projectKey}
          customerId={customer.id}
          canUpload={can('files', 'create') && can('crm', 'edit')}
        />
      ) : (
        <CrmDetailCard title="Files" icon={Files} className="lg:col-span-2">
          <p className="text-muted-foreground">You do not have access to project files.</p>
        </CrmDetailCard>
      )}

      <CrmDetailCard title="Last communication" icon={PhoneCall}>
        <p className="whitespace-pre-wrap text-muted-foreground">
          {customer.lastCommunication || 'No communication recorded.'}
        </p>
      </CrmDetailCard>

      <CrmDetailCard title="Next action" icon={MessageSquareText}>
        <p className="font-medium">{customer.nextAction || 'No next action recorded.'}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Deadline: {customer.deadline ? formatDate(customer.deadline) : 'Not set'}
        </p>
      </CrmDetailCard>
    </div>
  );
}
