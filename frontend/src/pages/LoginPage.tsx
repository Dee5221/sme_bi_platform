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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    // Client-side validation
    const next: Record<string, string> = {};
    if (!email.trim()) {
      next.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = 'Please enter a valid email address.';
    }
    if (!password) {
      next.password = 'Password is required.';
    }
    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      return;
    }

    setLoading(true);
    try {
      await login({ email, password });
      pushToast('Welcome back.', 'success');
      navigate('/app', { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        if (Array.isArray(err.details)) {
          const parsed: Record<string, string> = {};
          for (const item of err.details as { loc?: string[]; msg?: string }[]) {
            if (item.loc && item.msg) {
              const fieldName = item.loc[item.loc.length - 1];
              parsed[fieldName] = item.msg;
            }
          }
          setFieldErrors(parsed);
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
      <div className="auth-layout">
        {/* Left: Brand Panel */}
        <aside className="auth-brand-panel" aria-hidden="true">
          <div className="auth-brand-panel__inner">
            <div className="auth-brand-panel__logo">
              <div className="auth-brand-panel__logo-mark">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M3 3v18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 14l4-4 4 4 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="auth-brand-panel__logo-text">SME Intelligence</span>
            </div>

            <div className="auth-brand-panel__content">
              <h1 className="auth-brand-panel__heading">
                Turn your business data into better decisions.
              </h1>
              <p className="auth-brand-panel__subheading">
                A unified workspace for SMEs to track sales, monitor inventory,
                and understand operational performance — all in one place.
              </p>

              <div className="auth-brand-panel__features">
                <div className="auth-feature-card">
                  <div className="auth-feature-card__icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M3 3v18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M7 12l4-4 3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="auth-feature-card__body">
                    <div className="auth-feature-card__label">Sales Insights</div>
                    <div className="auth-feature-card__desc">Track revenue and trends</div>
                  </div>
                </div>

                <div className="auth-feature-card">
                  <div className="auth-feature-card__icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="auth-feature-card__body">
                    <div className="auth-feature-card__label">Inventory Visibility</div>
                    <div className="auth-feature-card__desc">Monitor stock in real time</div>
                  </div>
                </div>

                <div className="auth-feature-card">
                  <div className="auth-feature-card__icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                      <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="auth-feature-card__body">
                    <div className="auth-feature-card__label">Business Performance</div>
                    <div className="auth-feature-card__desc">KPIs and decision support</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="auth-brand-panel__footer">
              Built for growing businesses.
            </div>
          </div>
        </aside>

        {/* Right: Login Form */}
        <main className="auth-form-panel">
          <div className="auth-form-panel__inner">
            <div className="auth-form-panel__header">
              <h2 className="auth-form-panel__title">Welcome back</h2>
              <p className="auth-form-panel__subtitle">
                Sign in to continue to your business workspace.
              </p>
            </div>

            <form className="auth-form" onSubmit={onSubmit} noValidate>
              {error ? (
                <div className="auth-form__alert">
                  <Alert tone="error">{error}</Alert>
                </div>
              ) : null}

              <div className="auth-form__field">
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
              </div>

              <div className="auth-form__field">
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
              </div>

              <div className="auth-form__actions">
                <Button type="submit" loading={loading} >
                  Sign in
                </Button>
              </div>

              <p className="auth-form__register">
                Don't have a business account?{' '}
                <Link to="/register" className="auth-form__register-link">
                  Register your SME
                </Link>
              </p>
            </form>

            <div className="auth-form-panel__footer">
              <span>© {new Date().getFullYear()} SME Intelligence Platform</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}