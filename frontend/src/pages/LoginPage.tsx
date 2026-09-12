import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import './auth.css';

export function LoginPage() {
  const { login } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('owner@amfinancial.local');
  const [password, setPassword] = useState('OwnerPass1');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);
    try {
      await login({ email, password });
      pushToast('Welcome back.', 'success');
      navigate('/app', { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        if (Array.isArray(err.details)) {
          const next: Record<string, string> = {};
          for (const item of err.details as { path?: string; message?: string }[]) {
            if (item.path && item.message) next[item.path] = item.message;
          }
          setFieldErrors(next);
        }
      } else {
        setError('Unable to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-brand">
          <p className="auth-brand__eyebrow">SME Intelligence</p>
          <h1>Sign in to your business</h1>
          <p className="auth-brand__copy">
            Secure access for your business. Owner: owner@amfinancial.local / OwnerPass1
          </p>
        </div>

        <form className="auth-form" onSubmit={onSubmit} noValidate>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            required
          />
          <Input
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            required
          />
          <Button type="submit" loading={loading}>
            Sign in
          </Button>
          <p className="auth-switch">
            New business? <Link to="/register">Register your SME</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
