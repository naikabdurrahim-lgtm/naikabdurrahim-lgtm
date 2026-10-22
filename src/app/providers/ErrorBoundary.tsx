import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import i18n from '@/lib/i18n';
import { Button } from '@/components/ui/button';

type Props = { children: ReactNode };
type State = { hasError: boolean; errorId: string | null };

/**
 * Last-resort boundary. Users see plain Bangla (PROJECT_RULES 3.1 #9); the
 * technical detail goes to the console now and to Sentry in Phase 12.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorId: null };

  static getDerivedStateFromError(): State {
    return { hasError: true, errorId: crypto.randomUUID().slice(0, 8) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', this.state.errorId, error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const t = i18n.t.bind(i18n);
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6">
        <div className="app-card w-full max-w-md space-y-4 p-6 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle aria-hidden="true" className="size-7" />
          </div>
          <h1 className="text-xl font-semibold">{t('errors.title')}</h1>
          <p className="text-muted-foreground">{t('errors.unexpected')}</p>
          <p className="font-mono text-xs text-muted-foreground/70">#{this.state.errorId}</p>
          <div className="flex flex-col gap-2 pt-2">
            <Button size="lg" className="min-h-cta" onClick={() => window.location.reload()}>
              <RotateCcw aria-hidden="true" />
              {t('errors.tryAgain')}
            </Button>
            <Button variant="ghost" onClick={this.handleReload}>
              <Home aria-hidden="true" />
              {t('errors.goHome')}
            </Button>
          </div>
        </div>
      </main>
    );
  }
}
