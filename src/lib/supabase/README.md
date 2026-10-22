# Supabase data access

Three rules, enforced by the database itself:

1. **The anon key only.** `client.ts` never sees a service-role key.
2. **Money and stock are written through RPCs, never by direct inserts.**
   `sales`, `sale_items`, `payments`, `ledger_entries` and `stock_movements`
   have no INSERT policy at all. The only writers are
   `create_sale`, `collect_due`, `void_sale` and `record_stock_movement`
   (see `supabase/migrations/0009_functions.sql`). The functions recompute every
   total server-side, so a modified client cannot forge an amount.
3. **Reads are filtered by RLS.** Tenant isolation and role rules live in
   `supabase/migrations/0008_rls.sql`, not in this folder.

## Calling a write RPC

```ts
import { getSupabase } from '@/lib/supabase/client';

const sb = getSupabase();
if (!sb) throw new Error('Supabase is not configured');

const { data, error } = await sb.rpc('create_sale', {
  p_tenant: tenantId,
  p_payload: {
    client_id: crypto.randomUUID(), // stable per sale: retries are safe
    customer_id: null,
    paid_paisa: 22000,
    payment_method: 'cash',
    items: [{ product_id, qty: 2, unit_price_paisa: 11000 }],
  },
});
```

`client_id` is what makes offline retries safe: sending the same sale twice
returns the original sale instead of creating a duplicate.

## Reading

```ts
const { data: products } = await sb
  .from('products')
  .select('id, name, sell_price_paisa, stock_qty')
  .eq('tenant_id', tenantId)
  .is('deleted_at', null);
```

Cashiers read receipts from `v_sale_items_receipt` (no cost price).
Profit comes from `v_daily_summary` or `tenant_day_summary()`, both of which
return nothing to a cashier.

## Types

`database.types.ts` mirrors the migrations. After changing the schema, run
`npm run db:types` (needs the Supabase CLI) and commit the result.
