import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PinInput } from './PinInput';

/** A small harness so the component is exercised the way the pages use it. */
function Harness({ onComplete }: { onComplete: (pin: string) => void }) {
  const [value, setValue] = useState('');
  return <PinInput label="পিন" value={value} onChange={setValue} onComplete={onComplete} />;
}

const boxes = () => screen.getAllByLabelText(/^পিন \d$/);

describe('PinInput', () => {
  it('renders one labelled box per digit, each a full-size touch target', () => {
    render(<Harness onComplete={() => undefined} />);
    const inputs = boxes();
    expect(inputs).toHaveLength(6);
    // 56px (h-14) tall — above the 48px minimum in PROJECT_RULES 3.1.
    for (const input of inputs) expect(input.className).toContain('h-14');
    // Masked, numeric keyboard, no autofill of the old PIN.
    for (const input of inputs) {
      expect(input).toHaveAttribute('type', 'password');
      expect(input).toHaveAttribute('inputmode', 'numeric');
      expect(input).toHaveAttribute('autocomplete', 'off');
    }
  });

  it('fills the boxes one digit at a time and reports the finished PIN', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    const inputs = boxes();

    '482915'.split('').forEach((digit, index) => {
      fireEvent.change(inputs[index] as HTMLElement, { target: { value: digit } });
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('482915');
  });

  it('does not report a PIN before the sixth digit', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.change(boxes()[0] as HTMLElement, { target: { value: '4' } });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('accepts a paste / autofill of all six digits into one box', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.change(boxes()[0] as HTMLElement, { target: { value: '482915' } });
    expect(onComplete).toHaveBeenCalledWith('482915');
  });

  it('ignores letters and never exceeds six digits', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    const inputs = boxes();

    fireEvent.change(inputs[0] as HTMLElement, { target: { value: 'a' } });
    expect((inputs[0] as HTMLInputElement).value).toBe('');

    fireEvent.change(inputs[0] as HTMLElement, { target: { value: '1234567890' } });
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('clears the digit under the cursor on Backspace', () => {
    render(<Harness onComplete={() => undefined} />);
    const inputs = boxes();
    fireEvent.change(inputs[0] as HTMLElement, { target: { value: '4' } });
    fireEvent.change(inputs[1] as HTMLElement, { target: { value: '8' } });
    expect((inputs[1] as HTMLInputElement).value).toBe('8');

    fireEvent.keyDown(inputs[1] as HTMLElement, { key: 'Backspace' });
    expect((inputs[1] as HTMLInputElement).value).toBe('');
    // The earlier digit survives, so the user can retype only what was wrong.
    expect((inputs[0] as HTMLInputElement).value).toBe('4');
  });

  it('moves focus back when Backspace is pressed in an empty box', () => {
    render(<Harness onComplete={() => undefined} />);
    const inputs = boxes();
    fireEvent.change(inputs[0] as HTMLElement, { target: { value: '4' } });

    (inputs[1] as HTMLInputElement).focus();
    fireEvent.keyDown(inputs[1] as HTMLElement, { key: 'Backspace' });

    expect(document.activeElement).toBe(inputs[0]);
    expect((inputs[0] as HTMLInputElement).value).toBe('');
  });

  it('marks the boxes invalid so the error is not colour-only', () => {
    const { rerender } = render(<PinInput label="পিন" value="48" onChange={() => undefined} />);
    const before = boxes()[0] as HTMLInputElement;
    expect(before).toHaveAttribute('aria-invalid', 'false');

    rerender(<PinInput label="পিন" value="48" onChange={() => undefined} invalid />);
    expect(boxes()[0]).toHaveAttribute('aria-invalid', 'true');
  });

  it('disables every box while a request is in flight', () => {
    render(<PinInput label="পিন" value="482915" onChange={() => undefined} disabled />);
    for (const input of boxes()) expect(input).toBeDisabled();
  });
});
