import { FormEvent, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const errorId = useId();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);
    try {
      await register(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to create account. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page center">
      <main id="main-content" className="card auth-card" tabIndex={-1}>
        <h1>Create account</h1>
        <p className="muted">Save lists across your devices</p>

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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              aria-describedby={`${passwordId}-hint`}
            />
          </label>
          <p id={`${passwordId}-hint`} className="field-hint muted small">
            At least 8 characters.
          </p>

          <label htmlFor={confirmId}>
            Confirm password
            <input
              id={confirmId}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
            />
          </label>

          {error && (
            <p id={errorId} className="error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className="footer-link">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </main>
    </div>
  );
}
