import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import bnAuth from '@/locales/bn/auth.json';
import bnCommon from '@/locales/bn/common.json';
import { AuthError } from '@/features/auth/lib/authErrors';
import '@/lib/i18n';

import { SignInPage } from './SignInPage';

const signIn = vi.fn();
const getLockoutState = vi.fn();

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({ signIn, status: 'signed_out' }),
}));

vi.mock('@/features/auth/lib/authService', () => ({
  getLockoutState: (...args: unknown[]) => getLockoutState(...args),
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/sign-in']}>
      <SignInPage />
    </MemoryRouter>,
  );

/** The six boxes are labelled "<pinLabel> 1" … "<pinLabel> 6". */
const pinBoxes = () => screen.getAllByLabelText(new RegExp(`^${bnAuth.pinLabel} \\d$`));

const fillValidCredentials = () => {
  fireEvent.change(screen.getByLabelText(bnAuth.phoneLabel), {
    target: { value: '01712345678' },
  });
  const boxes = pinBoxes();
  '482915'.split('').forEach((digit, index) => {
    fireEvent.change(boxes[index] as HTMLElement, { target: { value: digit } });
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  getLockoutState.mockResolvedValue({
    locked: false,
    attemptsRemaining: 5,
    retryAfterSeconds: 0,
  });
});

describe('SignInPage', () => {
  it('shows the Bangla welcome and both fields', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(bnAuth.welcome);
    expect(screen.getByLabelText(bnAuth.phoneLabel)).toBeInTheDocument();
    expect(pinBoxes()).toHaveLength(6);
    expect(screen.getByRole('button', { name: new RegExp(bnAuth.signInButton) })).toBeDisabled();
  });

  it('enables the button only for a valid phone and six digits', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(bnAuth.phoneLabel), {
      target: { value: '0171234' },
    });
    expect(screen.getByRole('button', { name: new RegExp(bnAuth.signInButton) })).toBeDisabled();

    fillValidCredentials();
    expect(screen.getByRole('button', { name: new RegExp(bnAuth.signInButton) })).toBeEnabled();
  });

  it('signs in with the E.164 phone, never the raw typed value', async () => {
    signIn.mockResolvedValue(undefined);
    renderPage();
    fillValidCredentials();

    fireEvent.click(screen.getByRole('button', { name: new RegExp(bnAuth.signInButton) }));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('+8801712345678', '482915'));
  });

  it('turns a wrong PIN into a Bangla sentence and clears the PIN', async () => {
    signIn.mockRejectedValue(new AuthError({ code: 'invalid_credentials' }));
    renderPage();
    fillValidCredentials();

    fireEvent.click(screen.getByRole('button', { name: new RegExp(bnAuth.signInButton) }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(bnAuth.errors.invalid_credentials);
    expect(alert).not.toHaveTextContent('Invalid login credentials');

    // The phone stays, so the user only retypes six digits.
    expect(screen.getByLabelText(bnAuth.phoneLabel)).toHaveValue('01712345678');
    for (const box of pinBoxes()) {
      expect((box as HTMLInputElement).value).toBe('');
    }
  });

  it('shows the lockout banner and disables the PIN when the account is locked', async () => {
    signIn.mockRejectedValue(new AuthError({ code: 'locked', retryAfterSeconds: 900 }));
    renderPage();
    fillValidCredentials();

    fireEvent.click(screen.getByRole('button', { name: new RegExp(bnAuth.signInButton) }));

    expect(await screen.findByText(bnAuth.lockedTitle)).toBeInTheDocument();
    for (const box of pinBoxes()) expect(box).toBeDisabled();
    expect(screen.getByRole('button', { name: new RegExp(bnAuth.signInButton) })).toBeDisabled();
  });

  it('warns before the last attempt is spent', async () => {
    getLockoutState.mockResolvedValue({
      locked: false,
      attemptsRemaining: 2,
      retryAfterSeconds: 0,
    });
    renderPage();

    fireEvent.change(screen.getByLabelText(bnAuth.phoneLabel), {
      target: { value: '01712345678' },
    });

    // The wording lives in the locale file; the count is interpolated into it.
    const expected = bnAuth.remainingAttempts.replace('{{count}}', '2');
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it('links to sign-up and to the health check', () => {
    renderPage();
    expect(screen.getByRole('link', { name: new RegExp(bnAuth.goSignUp) })).toHaveAttribute(
      'href',
      '/sign-up',
    );
    expect(screen.getByRole('link', { name: bnCommon.health.title })).toHaveAttribute(
      'href',
      '/health',
    );
  });
});
