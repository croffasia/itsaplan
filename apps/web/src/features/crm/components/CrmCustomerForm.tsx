import { useState, type FormEvent } from 'react';
import type { CrmCustomer, CrmCustomerInput } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CRM_STATUS_LABELS } from '../utils/crmStatus';

const EMPTY_CUSTOMER: CrmCustomerInput = {
  name: '',
  status: 'prospect',
  service: '',
  owner: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  projectStatus: '',
  openTasks: '',
  notes: '',
  lastCommunication: '',
  nextAction: '',
  deadline: null,
};

function customerInput(customer: CrmCustomer | undefined): CrmCustomerInput {
  if (!customer) return EMPTY_CUSTOMER;
  return {
    name: customer.name,
    status: customer.status,
    service: customer.service,
    owner: customer.owner,
    contactName: customer.contactName,
    contactEmail: customer.contactEmail,
    contactPhone: customer.contactPhone,
    projectStatus: customer.projectStatus,
    openTasks: customer.openTasks,
    notes: customer.notes,
    lastCommunication: customer.lastCommunication,
    nextAction: customer.nextAction,
    deadline: customer.deadline,
  };
}

export default function CrmCustomerForm({
  customer,
  pending,
  onCancel,
  onSubmit,
}: {
  customer?: CrmCustomer;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (input: CrmCustomerInput) => Promise<void>;
}) {
  const [values, setValues] = useState<CrmCustomerInput>(() => customerInput(customer));

  const update = <K extends keyof CrmCustomerInput>(key: K, value: CrmCustomerInput[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!values.name.trim()) return;
    void onSubmit(values);
  };

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="crm-name">Company</Label>
          <Input
            id="crm-name"
            value={values.name}
            autoFocus
            required
            maxLength={200}
            placeholder="Company name"
            onChange={(event) => update('name', event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="crm-status">Status</Label>
          <Select
            value={values.status}
            onValueChange={(value) => update('status', value as CrmCustomerInput['status'])}
          >
            <SelectTrigger id="crm-status" className="w-full rounded-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CRM_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="crm-service">Sold service</Label>
          <Input
            id="crm-service"
            value={values.service}
            maxLength={200}
            placeholder="Website, automation, consulting…"
            onChange={(event) => update('service', event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="crm-owner">Owner</Label>
          <Input
            id="crm-owner"
            value={values.owner}
            maxLength={200}
            placeholder="Danil"
            onChange={(event) => update('owner', event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="crm-contact-name">Contact name</Label>
          <Input
            id="crm-contact-name"
            value={values.contactName}
            maxLength={200}
            placeholder="Primary contact"
            onChange={(event) => update('contactName', event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="crm-contact-email">Email</Label>
          <Input
            id="crm-contact-email"
            type="email"
            value={values.contactEmail}
            maxLength={320}
            placeholder="contact@company.com"
            onChange={(event) => update('contactEmail', event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="crm-contact-phone">Phone</Label>
          <Input
            id="crm-contact-phone"
            type="tel"
            value={values.contactPhone}
            maxLength={200}
            placeholder="+31 6 12345678"
            onChange={(event) => update('contactPhone', event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="crm-project-status">Project status</Label>
          <Input
            id="crm-project-status"
            value={values.projectStatus}
            maxLength={200}
            placeholder="In progress"
            onChange={(event) => update('projectStatus', event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="crm-open-tasks">Open tasks</Label>
          <Textarea
            id="crm-open-tasks"
            value={values.openTasks}
            maxLength={10_000}
            className="min-h-28"
            placeholder={'Process feedback\nPublish website'}
            onChange={(event) => update('openTasks', event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="crm-notes">Notes</Label>
          <Textarea
            id="crm-notes"
            value={values.notes}
            maxLength={10_000}
            className="min-h-28"
            placeholder="Important context about this customer"
            onChange={(event) => update('notes', event.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="crm-last-communication">Last communication</Label>
          <Textarea
            id="crm-last-communication"
            value={values.lastCommunication}
            maxLength={10_000}
            className="min-h-20"
            placeholder="Summary of the latest call, meeting, or email"
            onChange={(event) => update('lastCommunication', event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <div className="space-y-1.5">
          <Label htmlFor="crm-next-action">Next action</Label>
          <Input
            id="crm-next-action"
            value={values.nextAction}
            maxLength={200}
            placeholder="Schedule intake"
            onChange={(event) => update('nextAction', event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="crm-deadline">Deadline</Label>
          <Input
            id="crm-deadline"
            type="date"
            value={values.deadline ?? ''}
            onChange={(event) => update('deadline', event.target.value || null)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!values.name.trim() || pending}>
          {pending ? 'Saving…' : customer ? 'Save changes' : 'Create customer'}
        </Button>
      </div>
    </form>
  );
}
