import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import './auth.css';

type FormState = {
  businessName: string;
  businessEmail: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

const initial: FormState = {
  businessName: '',
  businessEmail: '',
  firstName: '',
  lastName: '',
  email: '',
  password: '',
};

export function RegisterPage() {
  const { register } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);
    try {
      await register({
        businessName: form.businessName,
        businessEmail: form.businessEmail || undefined,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
      });
      pushToast('Business account created.', 'success');
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
        setError('Unable to register. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel auth-panel--wide">
        <div className="auth-brand">
          <p className="auth-brand__eyebrow">SME Intelligence</p>
          <h1>Register your business</h1>
          <p className="auth-brand__copy">
            Creates your business workspace and an Owner / Manager account.
          </p>
        </div>

        <form className="auth-form auth-form--grid" onSubmit={onSubmit} noValidate>
          {error ? (
            <div className="auth-form__full">
              <Alert tone="error">{error}</Alert>
            </div>
          ) : null}

          <Input
            label="Business name"
            name="businessName"
            value={form.businessName}
            onChange={(e) => update('businessName', e.target.value)}
            error={fieldErrors.businessName}
            required
          />
          <Input
            label="Business email (optional)"
            name="businessEmail"
            type="email"
            value={form.businessEmail}
            onChange={(e) => update('businessEmail', e.target.value)}
            error={fieldErrors.businessEmail}
          />
          <Input
            label="First name"
            name="firstName"
            value={form.firstName}
            onChange={(e) => update('firstName', e.target.value)}
            error={fieldErrors.firstName}
            required
          />
          <Input
            label="Last name"
            name="lastName"
            value={form.lastName}
            onChange={(e) => update('lastName', e.target.value)}
            error={fieldErrors.lastName}
            required
          />
          <Input
            label="Login email"
            name="email"
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            error={fieldErrors.email}
            required
          />
          <Input
            label="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            error={fieldErrors.password}
            hint="At least 8 characters with a letter and a number."
            required
          />

          <div className="auth-form__full">
            <Button type="submit" loading={loading}>
              Create account
            </Button>
            <p className="auth-switch">
              Already registered? <Link to="/login">Sign in</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
