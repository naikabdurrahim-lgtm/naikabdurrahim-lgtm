import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, LogIn, Store } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { PhoneInput } from '@/components/common/PhoneInput';
import { PinInput } from '@/components/common/PinInput';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';
import { AuthError } from '@/features/auth/lib/authErrors';
import { getLockoutState } from '@/features/auth/lib/authService';
import { normaliseBdPhone } from '@/features/auth/lib/phone';
import { PIN_LENGTH } from '@/features/auth/lib/pin';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';

/**
 * Phone + 6-digit PIN.
 *
 * Design notes:
 * - one screen, two fields, one primary button at the bottom (one-handed);
 * - the lockout state is fetched when the phone number is complete, so the user
 *   is warned *before* spending an attempt;
 * - every failure is a plain Bangla sentence, never a Supabase message.
 */
export function SignInPage() {
  const { t } = useAppTranslation('auth');
  const { signIn, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lockedFor, setLockedFor] = useState(0);

  const normalised = normaliseBdPhone(phone);

  // Warn as soon as the number is valid.
  useEffect(() => {
    let cancelled = false;
    if (!normalised) {
      setAttemptsLeft(null);
      return;
    }
    void getLockoutState(normalised).then((state) => {
      if (cancelled) return;
      setAttemptsLeft(state.attemptsRemaining);
      setLockedFor(state.locked ? state.retryAfterSeconds : 0);
    });
    return () => {
      cancelled = true;
    };
  }, [normalised]);

  // Count the lockout down so the screen unfreezes by itself.
  useEffect(() => {
    if (lockedFor <= 0) return;
    const id = window.setInterval(() => setLockedFor((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [lockedFor]);

  if (status === 'signed_in') return <Navigate to={from} replace />;

  const canSubmit = Boolean(normalised) && pin.length === PIN_LENGTH && !busy && lockedFor === 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !normalised) return;

    setBusy(true);
    setErrorCode(null);
    try {
      await signIn(normalised, pin);
      navigate(from, { replace: true });
    } catch (error) {
      const authError = error instanceof AuthError ? error : null;
      setErrorCode(authError?.code ?? 'unknown');
      if (authError?.code === 'locked') {
        setLockedFor(authError.retryAfterSeconds ?? 900);
      } else {
        const state = await getLockoutState(normalised);
        setAttemptsLeft(state.attemptsRemaining);
      }
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const lockMinutes = Math.max(1, Math.ceil(lockedFor / 60));

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-8">
        <header className="space-y-3 text-center">
          <span
            aria-hidden="true"
            className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary"
          >
            <Store className="size-8" />
          </span>
          <h1 className="text-2xl font-bold">{t('welcome')}</h1>
          <p className="text-sm text-muted-foreground">{t('welcomeHint')}</p>
        </header>

        {lockedFor > 0 ? (
          <div
            role="alert"
            className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm"
          >
            <p className="font-semibold">{t('lockedTitle')}</p>
            <p className="mt-1 text-muted-foreground">
              {t('lockedBody', { minutes: lockMinutes })}
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <PhoneInput
            label={t('phoneLabel')}
            hint={t('phoneHint')}
            value={phone}
            onChange={(value) => {
              setPhone(value);
              setErrorCode(null);
            }}
            autoFocus
            disabled={busy}
          />

          <div className="space-y-2">
            <PinInput
              label={t('pinLabel')}
              value={pin}
              onChange={(value) => {
                setPin(value);
                setErrorCode(null);
              }}
              disabled={busy || lockedFor > 0}
              purpose="current-pin"
              invalid={Boolean(errorCode)}
            />
            {attemptsLeft !== null && attemptsLeft < 5 && lockedFor === 0 ? (
              <p className="text-xs text-warning">
                {t('remainingAttempts', { count: attemptsLeft })}
              </p>
            ) : null}
          </div>

          {errorCode ? (
            <p role="alert" className="rounded-xl bg-money-out/10 p-3 text-sm text-money-out">
              {t(`errors.${errorCode}`)}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
            {busy ? (
              <>
                <Loader2 aria-hidden="true" className="animate-spin" />
                {t('signingIn')}
              </>
            ) : (
              <>
                <LogIn aria-hidden="true" />
                {t('signInButton')}
              </>
            )}
          </Button>
        </form>

        {/* Honest recovery path: self-service reset needs the admin API, which
            must never reach a browser. Until Phase 10 adds a request queue, the
            recovery code is the proof support uses. */}
        <details className="rounded-xl border border-border/60 bg-secondary/30 p-3 text-sm">
          <summary className="cursor-pointer font-medium">{t('recovery.helpTitle')}</summary>
          <p className="mt-2 text-muted-foreground">{t('recovery.helpBody')}</p>
        </details>

        <div className="space-y-2 text-center text-sm">
          <p className="text-muted-foreground">{t('noAccount')}</p>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link to="/sign-up">
              {t('goSignUp')}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </main>

      <footer className="pb-6 text-center text-xs text-muted-foreground">
        <Link to="/health" className="underline-offset-4 hover:underline">
          {t('common:health.title', { ns: 'common' })}
        </Link>
      </footer>
    </div>
  );
}
