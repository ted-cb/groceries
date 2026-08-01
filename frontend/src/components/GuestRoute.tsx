import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/** Redirect authenticated users away from login/register. */
export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="page center">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
