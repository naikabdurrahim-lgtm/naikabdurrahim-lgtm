import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/lib/i18n';
import bn from '@/locales/bn/stock.json';
import type { StockItem } from '../types';

import { MovementSheet } from './MovementSheet';

/**
 * The movement sheet is the only way stock changes by hand, so the sign of the
 * quantity and the reason it carries are worth pinning down: a `-1.5` written as
 * `+1.5` is a wrong shelf count that nobody notices until the next stocktake.
 */

const recordAsync = vi.fn();

vi.mock('../queries', () => ({
  useRecordMovement: () => ({ mutateAsync: recordAsync, isPending: false }),
}));

const rice: StockItem = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'মিনিকেট চাল',
  unitCode: 'kg',
  stockMilli: 4000,
  alertMilli: 5000,
  sellPricePaisa: 7500,
  buyPricePaisa: 6800,
  stockValuePaisa: 27200,
  isService: false,
  lastMovementAt: null,
};

const setup = () => {
  const onRecorded = vi.fn();
  const onClose = vi.fn();
  render(
    <MovementSheet
      open
      tenantId="tenant-1"
      item={rice}
      onClose={onClose}
      onRecorded={onRecorded}
    />,
  );
  return { onRecorded, onClose };
};

beforeEach(() => {
  vi.clearAllMocks();
  recordAsync.mockResolvedValue({
    movementId: 'm-1',
    productId: rice.id,
    stockMilli: 2500,
    duplicate: false,
  });
});

describe('MovementSheet', () => {
  it('writes stock out as a negative quantity with its reason', async () => {
    const { onRecorded, onClose } = setup();

    fireEvent.click(screen.getByRole('button', { name: new RegExp(bn.sheet.out) }));
    fireEvent.change(screen.getByLabelText(bn.sheet.amount), { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(bn.sheet.confirm) }));

    await waitFor(() =>
      expect(recordAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: rice.id,
          type: 'damage',
          qtyMilli: -1500,
          reason: bn.reason.damage,
        }),
      ),
    );

    expect(onRecorded).toHaveBeenCalledWith(2500);
    expect(onClose).toHaveBeenCalled();
  });

  it('writes a purchase as a positive quantity at the cost on the field', async () => {
    setup();

    fireEvent.change(screen.getByLabelText(bn.sheet.amount), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(bn.sheet.confirm) }));

    await waitFor(() =>
      expect(recordAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'purchase',
          qtyMilli: 10_000,
          // The sheet pre-fills the last known cost.
          unitCostPaisa: 6800,
        }),
      ),
    );
  });

  it('refuses an empty quantity before it reaches the server', () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: new RegExp(bn.sheet.confirm) }));

    expect(screen.getByRole('alert').textContent).toBe(bn.form.quantityInvalid);
    expect(recordAsync).not.toHaveBeenCalled();
  });

  it("keeps the user's own note instead of the default reason", async () => {
    setup();

    fireEvent.change(screen.getByLabelText(bn.sheet.amount), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(bn.sheet.note), {
      target: { value: 'নতুন মাল এসেছে' },
    });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(bn.sheet.confirm) }));

    await waitFor(() =>
      expect(recordAsync).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'নতুন মাল এসেছে' }),
      ),
    );
  });

  it('explains a refusal in Bangla instead of showing the database error', async () => {
    recordAsync.mockRejectedValue({ name: 'StockApiError', code: 'forbidden' });
    // The sheet maps codes, so give it the real class.
    const { StockApiError } = await import('../types');
    recordAsync.mockRejectedValue(new StockApiError('forbidden'));

    setup();
    fireEvent.change(screen.getByLabelText(bn.sheet.amount), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(bn.sheet.confirm) }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(bn.form.forbidden));
  });
});
