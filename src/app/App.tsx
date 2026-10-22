import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { usePreferences } from '@/features/settings/preferences';
import { ErrorBoundary } from '@/app/providers/ErrorBoundary';
import { PreferencesProvider } from '@/app/providers/PreferencesProvider';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { router } from '@/app/router';

export function App() {
  const appearance = usePreferences((s) => s.appearance);

  return (
    <ErrorBoundary>
      <PreferencesProvider>
        <QueryProvider>
          <RouterProvider router={router} />
          {/* Toasts are always dark-friendly and respect the token palette. */}
          <Toaster position="top-center" closeButton richColors theme={appearance} />
        </QueryProvider>
      </PreferencesProvider>
    </ErrorBoundary>
  );
}
