import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The wire contract for customers and dues.
 *
 * Postgres does the arithmetic (0014), so what matters here is that the client
 * reads what the functions return — `bigint` arrives as a string — and that a
 * refused collection becomes a code the UI can translate instead of a raw
 * Postgres message.
 */

const rpc = vi.fn();
const update = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({ rpc, from: () => builder }),
}));

/** Chainable, thenable table stub for the two write paths. */
const builder = {
  insert: () => builder,
  select: () => builder,
  update: (values: unknown) => {
    update(values);
    return builder;
  },
  eq: () => builder,
  single: () => Promise.resolve({ data: updateResult, error: null }),
  then: (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(resolve),
};

let updateResult: unknown = null;

const {
  collectPayment,
  createCustomer,
  deleteCustomer,
  fetchCustomer,
  fetchCustomerLedger,
  fetchDueSummary,
  listCustomers,
  searchCustomers,
  updateCustomer,
  voidPayment,
} = await import('./api');

beforeEach(() => {
  vi.clearAllMocks();
  updateResult = null;
});

describe('listCustomers', () => {
  it('converts bigint strings to numbers and keeps the due', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          name: 'রহিম ভাই',
          phone: '+8801712345678',
          due_paisa: '6000',
          credit_limit_paisa: '20000',
          last_activity_at: '2026-01-02T04:00:00Z',
          created_at: '2026-01-01T04:00:00Z',
        },
      ],
      error: null,
    });

    const [row] = await listCustomers('tenant-1', { onlyDue: true });

    expect(row?.duePaisa).toBe(6000);
    expect(row?.creditLimitPaisa).toBe(20000);
    expect(rpc).toHaveBeenCalledWith(
      'list_customers',
      expect.objectContaining({ p_tenant: 'tenant-1', p_only_due: true }),
    );
  });

  it('leaves an empty search out of the call rather than sending undefined', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await listCustomers('tenant-1', { query: '   ' });

    const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect('p_query' in args).toBe(false);
  });

  it('turns a refused call into a code the UI can translate', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'not_a_member' },
    });

    await expect(listCustomers('tenant-1')).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('searchCustomers', () => {
  it('orders the POS picker by name, not by who owes the most', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: '00000000-0000-0000-0000-000000000002',
          name: 'সালমা',
          phone: null,
          due_paisa: '900',
          credit_limit_paisa: null,
          last_activity_at: null,
          created_at: '2026-01-01T04:00:00Z',
        },
        {
          id: '00000000-0000-0000-0000-000000000003',
          name: 'করিম',
          phone: null,
          due_paisa: '0',
          credit_limit_paisa: null,
          last_activity_at: null,
          created_at: '2026-01-01T04:00:00Z',
        },
      ],
      error: null,
    });

    const rows = await searchCustomers('tenant-1', '');
    expect(rows.map((row) => row.name)).toEqual(['করিম', 'সালমা']);
    expect(rows[1]?.duePaisa).toBe(900);
  });
});

describe('fetchDueSummary', () => {
  it('reads the single row a `returns table` function produces', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          total_due_paisa: '123400',
          debtor_count: '7',
          customer_count: '31',
          oldest_due_at: '2025-12-01T04:00:00Z',
        },
      ],
      error: null,
    });

    await expect(fetchDueSummary('tenant-1')).resolves.toEqual({
      totalDuePaisa: 123400,
      debtorCount: 7,
      customerCount: 31,
      oldestDueAt: '2025-12-01T04:00:00Z',
    });
  });

  it('reports a shop with no dues as zeroes, never as null', async () => {
    rpc.mockResolvedValue({
      data: [{ total_due_paisa: '0', debtor_count: '0', customer_count: '0', oldest_due_at: null }],
      error: null,
    });

    const summary = await fetchDueSummary('tenant-1');
    expect(summary.totalDuePaisa).toBe(0);
    expect(summary.debtorCount).toBe(0);
  });
});

describe('fetchCustomer and the ledger', () => {
  it('keeps a deleted customer readable', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: '00000000-0000-0000-0000-000000000004',
          name: 'করিম মিয়া',
          phone: '+8801811111111',
          address: null,
          note: null,
          due_paisa: '0',
          credit_limit_paisa: null,
          is_active: false,
          is_deleted: true,
          last_activity_at: null,
          created_at: '2026-01-01T04:00:00Z',
        },
      ],
      error: null,
    });

    const detail = await fetchCustomer('tenant-1', '00000000-0000-0000-0000-000000000004');
    expect(detail.isDeleted).toBe(true);
    expect(detail.duePaisa).toBe(0);
  });

  it('throws not_found when the function returns no row', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(fetchCustomer('tenant-1', 'missing')).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('parses the running balance the server computed', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: '00000000-0000-0000-0000-000000000005',
          entry_type: 'credit',
          amount_paisa: '4000',
          balance_after_paisa: '6000',
          occurred_at: '2026-01-03T04:00:00Z',
          note: 'বাকি আদায়',
          sale_id: null,
          payment_id: '00000000-0000-0000-0000-000000000006',
          invoice_no: null,
        },
      ],
      error: null,
    });

    const [entry] = await fetchCustomerLedger('tenant-1', 'customer-1');
    expect(entry).toMatchObject({
      entryType: 'credit',
      amountPaisa: 4000,
      balanceAfterPaisa: 6000,
      invoiceNo: null,
    });
  });
});

describe('writes', () => {
  it('normalises the phone before it is stored', async () => {
    updateResult = {
      id: '00000000-0000-0000-0000-000000000007',
      name: 'রহিম',
      phone: '+8801712345678',
    };

    const created = await createCustomer('tenant-1', { name: ' রহিম ', phone: '01712345678' });
    expect(created).toMatchObject({ name: 'রহিম', phone: '+8801712345678', duePaisa: 0 });
  });

  it('refuses a phone that is not a Bangladeshi mobile', async () => {
    await expect(
      createCustomer('tenant-1', { name: 'রহিম', phone: '12345' }),
    ).rejects.toMatchObject({ code: 'invalid_phone' });
  });

  it('sends an update with nulls for the empty optional fields', async () => {
    await updateCustomer('tenant-1', 'customer-1', {
      name: 'রহিম',
      phone: null,
      address: '  ',
      note: null,
      creditLimitPaisa: null,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'রহিম', phone: null, address: null, note: null }),
    );
  });

  it('deletes softly: the row stays for old invoices', async () => {
    await deleteCustomer('tenant-1', 'customer-1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: false, deleted_at: expect.any(String) }),
    );
  });
});

describe('collectPayment', () => {
  it('sends a client id so a retry cannot collect twice', async () => {
    rpc.mockResolvedValue({
      data: {
        payment_id: '00000000-0000-0000-0000-000000000008',
        amount_paisa: 4000,
        balance_paisa: 2000,
        duplicate: false,
      },
      error: null,
    });

    const result = await collectPayment('tenant-1', {
      customerId: 'customer-1',
      amountPaisa: 4000,
      method: 'bkash',
      clientId: '00000000-0000-0000-0000-000000000009',
    });

    expect(result).toEqual({
      paymentId: '00000000-0000-0000-0000-000000000008',
      amountPaisa: 4000,
      balancePaisa: 2000,
      duplicate: false,
    });

    const [, args] = rpc.mock.calls[0] as [string, { p_payload: Record<string, unknown> }];
    expect(args.p_payload.client_id).toBe('00000000-0000-0000-0000-000000000009');
    expect(args.p_payload.method).toBe('bkash');
  });

  it('maps an overpayment to a translatable code', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: '23514',
        message: 'overpayment: 5000 exceeds the outstanding balance of 2000',
      },
    });

    await expect(
      collectPayment('tenant-1', {
        customerId: 'customer-1',
        amountPaisa: 5000,
        method: 'cash',
        clientId: '00000000-0000-0000-0000-000000000010',
      }),
    ).rejects.toMatchObject({ code: 'overpayment' });
  });

  it('treats a duplicate reply as success, not as an error', async () => {
    rpc.mockResolvedValue({ data: { duplicate: true }, error: null });

    const result = await collectPayment('tenant-1', {
      customerId: 'customer-1',
      amountPaisa: 1000,
      method: 'cash',
      clientId: '00000000-0000-0000-0000-000000000011',
    });

    expect(result.duplicate).toBe(true);
  });
});

describe('voidPayment', () => {
  it('reports the balance the server recomputed', async () => {
    rpc.mockResolvedValue({
      data: { payment_id: 'p-1', amount_paisa: 4000, balance_paisa: 7500, already_voided: false },
      error: null,
    });

    await expect(voidPayment('tenant-1', 'p-1')).resolves.toEqual({
      alreadyVoided: false,
      balancePaisa: 7500,
    });
  });

  it('raises too_late as a forbidden-style refusal the UI can explain', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        message: 'too_late: collections can only be undone within ten minutes',
      },
    });

    await expect(voidPayment('tenant-1', 'p-1')).rejects.toMatchObject({ code: 'forbidden' });
  });
});
