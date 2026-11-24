import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { UrlNotAllowedError } from '@repo/net';

const pinnedFetch = mock(
  async (
    _url: string,
    _init?: { method?: string; headers?: Record<string, string>; body?: string },
  ) => Response.json({}),
);
mock.module('@repo/net', () => ({ pinnedFetch, UrlNotAllowedError }));

const { baserowListRows } = await import('../list-rows');
const { baserowListFields } = await import('../list-fields');
const { baserowUpdateRows } = await import('../update-rows');
const { baserowDeleteRows } = await import('../delete-rows');
const { baserowRequest, apiRoot, fieldList, idRef } = await import('../client');
const { verifyBaserow } = await import('../verify');

const credential = { token: 'db_token' };

function respond(status: number, body: unknown) {
  pinnedFetch.mockImplementation(async () => Response.json(body, { status }));
}

function lastCall() {
  const [url, init] = pinnedFetch.mock.calls.at(-1)!;
  return { url: new URL(url), init: init! };
}

describe('baserow client', () => {
  beforeEach(() => pinnedFetch.mockClear());

  it('maps the cloud web address to the API host and keeps a self-hosted origin', () => {
    expect(apiRoot({})).toBe('https://api.baserow.io');
    expect(apiRoot({ baseUrl: 'https://baserow.io/database/1/table/2' })).toBe(
      'https://api.baserow.io',
    );
    expect(apiRoot({ baseUrl: 'https://rows.example.com/' })).toBe('https://rows.example.com');
  });

  it('takes a table or row id bare or from a Baserow URL', () => {
    expect(idRef(12, 'table')).toBe(12);
    expect(idRef('https://baserow.io/database/1/table/12/34', 'table')).toBe(12);
    expect(idRef('https://baserow.io/database/1/table/12/34/row/56', 'row')).toBe(56);
    expect(() => idRef('the table', 'table')).toThrow('not a Baserow table id or URL');
  });

  it('quotes field names so commas and quotes stay inside one name', () => {
    expect(fieldList(['Name', '-Due, date', 'Say "hi"'])).toBe(
      '"Name","-Due, date","Say \\"hi\\""',
    );
  });

  it('sends the database token and names a missing table permission', async () => {
    respond(401, { error: 'ERROR_NO_PERMISSION_TO_TABLE', detail: 'nope' });
    await expect(baserowRequest(credential, 'GET', 'database/rows/table/1/')).rejects.toThrow(
      'no permission for this action',
    );
    expect(lastCall().init.headers).toMatchObject({ Authorization: 'Token db_token' });
  });

  it('passes a validation detail object on to the model', async () => {
    respond(400, {
      error: 'ERROR_REQUEST_BODY_VALIDATION',
      detail: { items: { '0': { Status: [{ error: 'Invalid option' }] } } },
    });
    await expect(baserowRequest(credential, 'POST', 'x')).rejects.toThrow('Invalid option');
  });

  it('names a wrong instance URL that answers with a web page', async () => {
    pinnedFetch.mockImplementation(async () => new Response('<html></html>', { status: 200 }));
    await expect(baserowRequest(credential, 'GET', 'x')).rejects.toThrow('Check the instance URL');
  });

  it('names SSRF_ALLOWED_HOSTS when the address is refused', async () => {
    pinnedFetch.mockImplementation(async () => {
      throw new UrlNotAllowedError('url must not point to a private or local address');
    });
    await expect(
      baserowRequest({ ...credential, baseUrl: 'http://baserow.internal' }, 'GET', 'x'),
    ).rejects.toThrow('SSRF_ALLOWED_HOSTS');
  });
});

describe('baserow tools', () => {
  beforeEach(() => pinnedFetch.mockClear());

  it('lists rows by field name with a filter tree, sort, field subset and paging', async () => {
    respond(200, { count: 41, next: 'https://api.baserow.io/next', results: [{ id: 1 }] });
    const result = await baserowListRows.execute(credential, {
      table: 7,
      filters: [
        { field: 'Status', type: 'contains', value: 'Done' },
        { field: 'Notes', type: 'empty' },
      ],
      filterType: 'OR',
      orderBy: ['-Due'],
      fields: ['Name', 'Due'],
      size: 20,
      page: 2,
    });
    const { url } = lastCall();
    expect(url.pathname).toBe('/api/database/rows/table/7/');
    expect(url.searchParams.get('user_field_names')).toBe('true');
    expect(JSON.parse(url.searchParams.get('filters')!)).toEqual({
      filter_type: 'OR',
      filters: [
        { field: 'Status', type: 'contains', value: 'Done' },
        { field: 'Notes', type: 'empty', value: '' },
      ],
    });
    expect(url.searchParams.get('order_by')).toBe('"-Due"');
    expect(url.searchParams.get('include')).toBe('"Name","Due"');
    expect(url.searchParams.get('page')).toBe('2');
    expect(result).toEqual({ total: 41, page: 2, hasMore: true, rows: [{ id: 1 }] });
  });

  it('lists fields with select options and the linked table', async () => {
    respond(200, [
      { id: 1, name: 'Name', type: 'text', primary: true, read_only: false },
      {
        id: 2,
        name: 'Status',
        type: 'single_select',
        primary: false,
        read_only: false,
        select_options: [{ id: 5, value: 'Done', color: 'green' }],
      },
      { id: 3, name: 'Owner', type: 'link_row', link_row_table_id: 9 },
    ]);
    const result = await baserowListFields.execute(credential, { table: '7' });
    expect(result).toEqual({
      fields: [
        { name: 'Name', type: 'text', primary: true, readOnly: false },
        {
          name: 'Status',
          type: 'single_select',
          primary: false,
          readOnly: false,
          options: [{ id: 5, name: 'Done' }],
        },
        { name: 'Owner', type: 'link_row', primary: false, readOnly: false, linkedTableId: 9 },
      ],
    });
  });

  it('updates rows in one batch with the id beside the values', async () => {
    respond(200, { items: [{ id: 3, Status: { id: 5, value: 'Done' } }] });
    await baserowUpdateRows.execute(credential, {
      table: 7,
      rows: [{ id: 3, values: { Status: 'Done' } }],
    });
    const { url, init } = lastCall();
    expect(init.method).toBe('PATCH');
    expect(url.pathname).toBe('/api/database/rows/table/7/batch/');
    expect(JSON.parse(init.body!)).toEqual({ items: [{ Status: 'Done', id: 3 }] });
  });

  it('deletes rows in one batch', async () => {
    pinnedFetch.mockImplementation(async () => new Response(null, { status: 204 }));
    const result = await baserowDeleteRows.execute(credential, { table: 7, ids: [3, 4] });
    const { url, init } = lastCall();
    expect(url.pathname).toBe('/api/database/rows/table/7/batch-delete/');
    expect(JSON.parse(init.body!)).toEqual({ items: [3, 4] });
    expect(result).toEqual({ deleted: [3, 4] });
  });
});

describe('verifyBaserow', () => {
  const signal = new AbortController().signal;

  it('rejects a token Baserow does not know and calls a failure without that code unavailable', async () => {
    respond(403, {
      error: 'ERROR_TOKEN_DOES_NOT_EXIST',
      detail: 'The provided token does not exist.',
    });
    expect(await verifyBaserow(credential, signal)).toBe('rejected');
    pinnedFetch.mockImplementation(async () => new Response('<html>', { status: 502 }));
    expect(await verifyBaserow(credential, signal)).toBe('unavailable');
    respond(200, {});
    expect(await verifyBaserow(credential, signal)).toBe('valid');
  });
});
