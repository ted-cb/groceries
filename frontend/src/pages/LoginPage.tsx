import { FormEvent, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to log in. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page center">
      <main id="main-content" className="card auth-card" tabIndex={-1}>
        <h1>Log in</h1>
        <p className="muted">Access your grocery lists</p>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="form"
          aria-describedby={error ? errorId : undefined}
        >
          <label htmlFor={emailId}>
            Email
            <input
              id={emailId}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>

          <label htmlFor={passwordId}>
            Password
            <input
              id={passwordId}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && (
            <p id={errorId} className="error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn primary" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="footer-link">
          No account? <Link to="/register">Create one</Link>
        </p>
      </main>
    </div>
  );
}
