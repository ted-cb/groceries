import { useAuth } from '../auth/AuthContext';

export function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="page">
      <header className="app-header">
        <div>
          <h1 className="app-title">Grocery List Manager</h1>
          <p className="muted small">Signed in as {user?.email}</p>
        </div>
        <button type="button" className="btn secondary" onClick={() => logout()}>
          Log out
        </button>
      </header>

      <main className="card shell">
        <h2>Your lists</h2>
        <p className="muted">
          You’re in. List management arrives in the next phase — for now this
          shell confirms auth and session persistence after refresh.
        </p>
      </main>
    </div>
  );
}
