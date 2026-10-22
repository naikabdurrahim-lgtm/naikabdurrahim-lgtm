import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import bnAuth from '@/locales/bn/auth.json';
import { AuthError } from '@/features/auth/lib/authErrors';
import { RECOVERY_CODE_LENGTH } from '@/features/auth/lib/recoveryCode';
import '@/lib/i18n';

import { SignUpPage } from './SignUpPage';

const signUp = vi.fn();
const saveRecoveryCode = vi.fn();

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({ signUp, status: 'signed_out' }),
}));

vi.mock('@/features/auth/lib/authService', () => ({
  saveRecoveryCode: (...args: unknown[]) => saveRecoveryCode(...args),
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/sign-up']}>
      <SignUpPage />
    </MemoryRouter>,
  );

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const fillPin = (label: string, pin: string) => {
  const boxes = screen.getAllByLabelText(new RegExp(`^${label} \\d$`));
  pin.split('').forEach((digit, index) => {
    fireEvent.change(boxes[index] as HTMLElement, { target: { value: digit } });
  });
};

const fillForm = (pin = '482915', confirm = '482915') => {
  type(bnAuth.nameLabel, 'আব্দুর রহিম');
  type(bnAuth.phoneLabel, '01712345678');
  fillPin(bnAuth.newPinLabel, pin);
  fillPin(bnAuth.confirmPinLabel, confirm);
};

const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(bnAuth.signUpButton) }));

beforeEach(() => {
  vi.clearAllMocks();
  saveRecoveryCode.mockResolvedValue(undefined);
});

describe('SignUpPage', () => {
  it('starts disabled and shows the rules', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(bnAuth.signUp);
    expect(screen.getByRole('button', { name: new RegExp(bnAuth.signUpButton) })).toBeDisabled();
    expect(screen.getByText(bnAuth.pinRules)).toBeInTheDocument();
  });

  it('says why a PIN was refused instead of only turning the boxes red', () => {
    renderPage();
    fillPin(bnAuth.newPinLabel, '123456');
    expect(screen.getByText(bnAuth.pinProblems.sequential)).toBeInTheDocument();
  });

  it('refuses a PIN built from the phone number', () => {
    renderPage();
    type(bnAuth.phoneLabel, '01901234567');
    fillPin(bnAuth.newPinLabel, '901234');
    expect(screen.getByText(bnAuth.pinProblems.phone_digits)).toBeInTheDocument();
  });

  it('never submits two different PINs', () => {
    renderPage();
    fillForm('482915', '482916');
    expect(screen.getByText(bnAuth.pinMismatch)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(bnAuth.signUpButton) })).toBeDisabled();
  });

  it('creates the account with the E.164 phone and the typed name', async () => {
    signUp.mockResolvedValue({ userId: 'user-1' });
    renderPage();
    fillForm();

    submit();

    expect(await screen.findByText(bnAuth.recovery.title)).toBeInTheDocument();
    expect(signUp).toHaveBeenCalledWith({
      phone: '+8801712345678',
      pin: '482915',
      fullName: 'আব্দুর রহিম',
    });
  });

  it('shows a fresh recovery code and stores it hashed server-side', async () => {
    signUp.mockResolvedValue({ userId: 'user-1' });
    renderPage();
    fillForm();
    submit();

    const code = await screen.findByLabelText(bnAuth.recovery.title);
    expect(code.textContent).toMatch(new RegExp(`^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$`));
    expect(code.textContent?.replace(/-/g, '')).toHaveLength(RECOVERY_CODE_LENGTH);
    expect(saveRecoveryCode).toHaveBeenCalledWith(code.textContent);
  });

  it('will not let the user continue until the code is acknowledged', async () => {
    signUp.mockResolvedValue({ userId: 'user-1' });
    renderPage();
    fillForm();
    submit();

    const next = await screen.findByRole('button', { name: new RegExp(bnAuth.recovery.continue) });
    expect(next).toBeDisabled();

    fireEvent.click(screen.getByLabelText(bnAuth.recovery.saved));
    expect(next).toBeEnabled();
  });

  it('does not lose the account when the recovery code cannot be stored', async () => {
    signUp.mockResolvedValue({ userId: 'user-1' });
    saveRecoveryCode.mockRejectedValue(new Error('offline'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderPage();
    fillForm();
    submit();

    // The code is still shown, so the user can write it down and continue.
    expect(await screen.findByLabelText(bnAuth.recovery.title)).toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('reports a duplicate phone in Bangla', async () => {
    signUp.mockRejectedValue(new AuthError({ code: 'phone_taken' }));
    renderPage();
    fillForm();
    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(bnAuth.errors.phone_taken);
  });
});
