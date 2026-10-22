-- =============================================================================
-- 0015 — Undoing a collection
-- =============================================================================
-- A shopkeeper who taps ৫০০ instead of ৫০ needs the same ten seconds of grace
-- on a collection that they get after a sale (PROJECT_RULES 3.1 #10). Sales are
-- reversed with void_sale(); payments had no equivalent, so this migration adds
-- one — and it reverses, it never edits: the money trail keeps both rows.
--
-- Who may reverse:
--   * owner / manager: any payment, any time (they are the ones who fix the
--     books after a shift);
--   * cashier: only a payment they themselves took, and only for ten minutes.
--     Long enough for the on-screen undo, short enough that yesterday's takings
--     cannot quietly disappear.
-- =============================================================================

alter table public.payments
  add column voided_at timestamptz,
  add column voided_by uuid,
  add column void_reason text,
  add constraint payments_void_reason_len check (void_reason is null or char_length(void_reason) <= 300);

comment on column public.payments.voided_at is
  'Set when a collection was reversed. The payment row itself is never deleted.';

create index payments_live_idx on public.payments (tenant_id, received_at desc)
  where voided_at is null;

-- The table was append-only (0005). It stays append-only in every way that
-- matters — amount, method, customer and date can never change — but the void
-- marker has to be set somewhere, so the trigger becomes a narrow guard.
drop trigger payments_no_update_delete on public.payments;

create or replace function app.guard_payment_update()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'append_only_violation: payments delete is not allowed (row %)', old.id
      using errcode = 'restrict_violation',
            hint = 'Reverse the payment with void_payment() instead.';
  end if;

  if old.voided_at is not null then
    raise exception 'append_only_violation: payment % is already reversed', old.id
      using errcode = 'restrict_violation';
  end if;

  if new.amount_paisa <> old.amount_paisa
     or new.method <> old.method
     or new.tenant_id <> old.tenant_id
     or new.client_id <> old.client_id
     or new.created_by <> old.created_by
     or new.created_at <> old.created_at
     or new.received_at <> old.received_at
     or new.customer_id is distinct from old.customer_id
     or new.sale_id is distinct from old.sale_id
     or new.note is distinct from old.note
     or new.reference is distinct from old.reference
  then
    raise exception 'append_only_violation: only the void marker may be written on a payment (row %)', old.id
      using errcode = 'restrict_violation',
            hint = 'Money rows are immutable. Reverse and re-collect instead.';
  end if;

  if new.voided_at is null then
    raise exception 'append_only_violation: an update to a payment must set voided_at (row %)', old.id
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

comment on function app.guard_payment_update() is
  'Keeps payments immutable except for the one-way void marker written by void_payment().';

create trigger payments_guard_update
  before update or delete on public.payments
  for each row execute function app.guard_payment_update();

-- ---------------------------------------------------------------- void_payment
create or replace function public.void_payment(
  p_tenant uuid,
  p_payment uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_payment public.payments;
  v_role public.member_role;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_tenant_member(p_tenant) then
    raise exception 'not_a_member' using errcode = 'insufficient_privilege';
  end if;

  select * into v_payment
  from public.payments
  where tenant_id = p_tenant and id = p_payment
  for update;

  if not found then
    raise exception 'not_found: no such payment' using errcode = 'no_data_found';
  end if;

  -- Idempotent: a double tap on "আনডু" must not reverse twice.
  if v_payment.voided_at is not null then
    return jsonb_build_object('payment_id', v_payment.id, 'already_voided', true);
  end if;

  select role into v_role
  from public.tenant_members
  where tenant_id = p_tenant and user_id = v_user;

  if v_role not in ('owner', 'manager') then
    if v_payment.created_by <> v_user then
      raise exception 'forbidden: you can only undo a collection you took yourself'
        using errcode = 'insufficient_privilege';
    end if;
    if v_payment.received_at < now() - interval '10 minutes' then
      raise exception 'too_late: collections can only be undone within ten minutes'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- The reversing entry points at the same payment so the khata can explain
  -- both lines ("আদায়" and "আদায় বাতিল") without a join to the void columns.
  insert into public.ledger_entries (
    tenant_id, customer_id, entry_type, amount_paisa, payment_id, note, created_by, client_id
  )
  values (
    p_tenant, v_payment.customer_id, 'debit', v_payment.amount_paisa, v_payment.id,
    coalesce(nullif(btrim(p_reason), ''), 'আদায় বাতিল'), v_user, gen_random_uuid()
  );

  update public.payments
  set voided_at = now(),
      voided_by = v_user,
      void_reason = coalesce(nullif(btrim(p_reason), ''), 'আদায় বাতিল')
  where id = v_payment.id;

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'amount_paisa', v_payment.amount_paisa,
    'balance_paisa', public.customer_balance(p_tenant, v_payment.customer_id),
    'already_voided', false
  );
end;
$$;

comment on function public.void_payment(uuid, uuid, text) is
  'Reverses a collection with a debit entry. Owners and managers any time; a cashier only their own, within ten minutes.';

revoke execute on function public.void_payment(uuid, uuid, text) from public;
grant execute on function public.void_payment(uuid, uuid, text) to authenticated, service_role;
