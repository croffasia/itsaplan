import { Elysia, t } from 'elysia';
import { authContext } from '../shared/auth-context';
import { entityGuard, guards } from '../shared/guards';
import { HttpError } from '../shared/lib';
import { noContent } from '../shared/http';
import { ErrorResponse } from '../shared/responses';
import {
  createCrmCustomer,
  deleteCrmCustomer,
  getCrmCustomerByPublicId,
  getCrmCustomerProjectId,
  listCrmCustomers,
  updateCrmCustomer,
  type CrmCustomerInput,
  type CrmCustomerPatch,
  type CrmCustomerRow,
} from './store';

const CrmStatus = t.UnionEnum(['prospect', 'active', 'inactive']);
const ShortText = t.String({ maxLength: 200 });
const LongText = t.String({ maxLength: 10_000 });
const Deadline = t.Nullable(t.String({ format: 'date' }));
const CustomerParams = t.Object({ customerId: t.String({ format: 'uuid' }) });
const ContactEmail = t.Union([t.Literal(''), t.String({ format: 'email', maxLength: 320 })]);

const CrmCustomerResponse = t.Object({
  id: t.String(),
  name: t.String(),
  status: CrmStatus,
  service: t.String(),
  owner: t.String(),
  contactName: t.String(),
  contactEmail: t.String(),
  contactPhone: t.String(),
  projectStatus: t.String(),
  openTasks: t.String(),
  notes: t.String(),
  lastCommunication: t.String(),
  nextAction: t.String(),
  deadline: Deadline,
  createdAt: t.String(),
  updatedAt: t.String(),
});

const CreateCrmCustomerBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 200 }),
  status: CrmStatus,
  service: ShortText,
  owner: ShortText,
  contactName: ShortText,
  contactEmail: ContactEmail,
  contactPhone: ShortText,
  projectStatus: ShortText,
  openTasks: LongText,
  notes: LongText,
  lastCommunication: LongText,
  nextAction: ShortText,
  deadline: Deadline,
});

function crmCustomerDto(row: CrmCustomerRow) {
  return {
    id: row.publicId,
    name: row.name,
    status: row.status,
    service: row.service,
    owner: row.owner,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    projectStatus: row.projectStatus,
    openTasks: row.openTasks,
    notes: row.notes,
    lastCommunication: row.lastCommunication,
    nextAction: row.nextAction,
    deadline: row.deadline,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function trimCustomer(input: CrmCustomerInput): CrmCustomerInput {
  return {
    ...input,
    name: input.name.trim(),
    service: input.service.trim(),
    owner: input.owner.trim(),
    contactName: input.contactName.trim(),
    contactEmail: input.contactEmail.trim(),
    contactPhone: input.contactPhone.trim(),
    projectStatus: input.projectStatus.trim(),
    openTasks: input.openTasks.trim(),
    notes: input.notes.trim(),
    lastCommunication: input.lastCommunication.trim(),
    nextAction: input.nextAction.trim(),
  };
}

function trimPatch(input: CrmCustomerPatch): CrmCustomerPatch {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trim() : value,
    ]),
  ) as CrmCustomerPatch;
}

export const crmRoutes = new Elysia({ name: 'crm', detail: { tags: ['CRM'] } })
  .use(authContext)
  .use(guards)
  .macro({
    crmCustomer: entityGuard('crm', 'Customer not found', (params) =>
      getCrmCustomerProjectId(params.customerId),
    ),
  })
  .get(
    '/projects/:projectKey/crm/customers',
    async ({ project }) => (await listCrmCustomers(project.id)).map(crmCustomerDto),
    {
      permission: ['crm', 'read'],
      response: {
        200: t.Array(CrmCustomerResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: "List a project's CRM customers" },
    },
  )
  .post(
    '/projects/:projectKey/crm/customers',
    async ({ project, body, set }) => {
      const input = trimCustomer(body);
      if (!input.name) throw new HttpError(400, 'Company name is required');
      const customer = await createCrmCustomer(project.id, input);
      set.status = 201;
      return crmCustomerDto(customer);
    },
    {
      permission: ['crm', 'create'],
      body: CreateCrmCustomerBody,
      response: {
        201: CrmCustomerResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Create a CRM customer' },
    },
  )
  .get(
    '/crm/customers/:customerId',
    async ({ params }) => {
      const customer = await getCrmCustomerByPublicId(params.customerId);
      if (!customer) throw new HttpError(404, 'Customer not found');
      return crmCustomerDto(customer);
    },
    {
      crmCustomer: 'read',
      params: CustomerParams,
      response: {
        200: CrmCustomerResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Get a CRM customer' },
    },
  )
  .patch(
    '/crm/customers/:customerId',
    async ({ params, body }) => {
      const patch = trimPatch(body);
      if (patch.name !== undefined && !patch.name) {
        throw new HttpError(400, 'Company name is required');
      }
      const customer = await updateCrmCustomer(params.customerId, patch);
      if (!customer) throw new HttpError(404, 'Customer not found');
      return crmCustomerDto(customer);
    },
    {
      crmCustomer: 'edit',
      params: CustomerParams,
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        status: t.Optional(CrmStatus),
        service: t.Optional(ShortText),
        owner: t.Optional(ShortText),
        contactName: t.Optional(ShortText),
        contactEmail: t.Optional(ContactEmail),
        contactPhone: t.Optional(ShortText),
        projectStatus: t.Optional(ShortText),
        openTasks: t.Optional(LongText),
        notes: t.Optional(LongText),
        lastCommunication: t.Optional(LongText),
        nextAction: t.Optional(ShortText),
        deadline: t.Optional(Deadline),
      }),
      response: {
        200: CrmCustomerResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Update a CRM customer' },
    },
  )
  .delete(
    '/crm/customers/:customerId',
    async ({ params }) => {
      if (!(await deleteCrmCustomer(params.customerId))) {
        throw new HttpError(404, 'Customer not found');
      }
      return noContent();
    },
    {
      crmCustomer: 'delete',
      params: CustomerParams,
      response: {
        204: t.Void(),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Delete a CRM customer' },
    },
  );
