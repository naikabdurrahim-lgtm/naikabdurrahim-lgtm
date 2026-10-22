import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/app/providers/ErrorBoundary';
import { PreferencesProvider } from '@/app/providers/PreferencesProvider';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { usePreferences } from '@/features/settings/preferences';
import { router } from '@/app/router';

export function App() {
  const appearance = usePreferences((s) => s.appearance);

  return (
    <ErrorBoundary>
      <PreferencesProvider>
        <QueryProvider>
          <AuthProvider>
            <RouterProvider router={router} />
            <Toaster position="top-center" closeButton richColors theme={appearance} />
          </AuthProvider>
        </QueryProvider>
      </PreferencesProvider>
    </ErrorBoundary>
  );
}
