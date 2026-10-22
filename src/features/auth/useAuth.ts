import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './AuthContext';

/** Session + shop context. Throws in development if used outside AuthProvider. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
