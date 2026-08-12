import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as authApi from '../services/authService';
import * as businessApi from '../services/businessService';
import type { BusinessSettings } from '../services/businessService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/Toast';
import './BusinessSettingsPage.css';

type BusinessForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
  usdToZmwRate: string;
};

function mapFieldErrors(details: unknown): Record<string, string> {
  const next: Record<string, string> = {};
  if (!Array.isArray(details)) return next;
  for (const item of details as { path?: string; message?: string }[]) {
    if (item.path && item.message) next[item.path] = item.message;
  }
  return next;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function BusinessSettingsPage() {
  const { setUser, hasPermission } = useAuth();
  const { pushToast } = useToast();
  const canView = hasPermission('business.view');
  const canUpdate = hasPermission('business.update');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [form, setForm] = useState<BusinessForm>({
    name: '',
    email: '',
    phone: '',
    address: '',
    usdToZmwRate: '18.5',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!canView) {
        setLoadError('You do not have permission to view business settings.');
        setLoading(false);
        return;
      }
      try {
        const result = await businessApi.fetchBusiness();
        if (!active) return;
        setBusiness(result.business);
        setForm({
          name: result.business.name,
          email: result.business.email || '',
          phone: result.business.phone || '',
          address: result.business.address || '',
          usdToZmwRate: String(result.business.usdToZmwRate ?? 18.5),
        });
        setLoadError(null);
      } catch (err) {
        if (!active) return;
        setLoadError(
          err instanceof ApiClientError ? err.message : 'Unable to load business settings.'
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [canView]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!canUpdate) return;
    setFormError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      const rate = Number(form.usdToZmwRate);
      if (!Number.isFinite(rate) || rate <= 0) {
        setFieldErrors({ usdToZmwRate: 'Enter a valid exchange rate greater than zero.' });
        setSaving(false);
        return;
      }
      const result = await businessApi.updateBusiness({
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        usdToZmwRate: rate,
      });
      setBusiness(result.business);
      const session = await authApi.fetchMe();
      setUser(session.user);
      pushToast('Business settings updated.', 'success');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        setFieldErrors(mapFieldErrors(err.details));
      } else {
        setFormError('Unable to update business settings.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (!canView) {
    return <Alert tone="error">You do not have permission to view business settings.</Alert>;
  }

  if (loading) {
    return (
      <Card>
        <LoadingSkeleton rows={6} />
      </Card>
    );
  }

  if (loadError || !business) {
    return <Alert tone="error">{loadError || 'Business settings unavailable.'}</Alert>;
  }

  return (
    <div className="business-settings-page">
      <PageHeader
        title="Business Settings"
        subtitle="Update the workspace profile used across this tenant."
      />

      <div className="business-settings-grid">
        <Card title="Workspace status">
          <dl className="business-settings-summary">
            <div>
              <dt>Status</dt>
              <dd>
                <Badge tone={business.isActive ? 'green' : 'orange'}>
                  {business.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(business.createdAt)}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{formatDate(business.updatedAt)}</dd>
            </div>
          </dl>
          <p className="business-settings-hint">
            The signed-in workspace cannot be deactivated from this screen.
          </p>
        </Card>

        <Card title="Business profile">
          <form className="business-settings-form" onSubmit={onSave} noValidate>
            {formError ? <Alert tone="error">{formError}</Alert> : null}
            <Input
              label="Business name"
              name="name"
              value={form.name}
              onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
              error={fieldErrors.name}
              disabled={!canUpdate}
              required
            />
            <div className="business-settings-form__row">
              <Input
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                error={fieldErrors.email}
                disabled={!canUpdate}
              />
              <Input
                label="Phone"
                name="phone"
                value={form.phone}
                onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                error={fieldErrors.phone}
                disabled={!canUpdate}
              />
            </div>
            <Input
              label="Address"
              name="address"
              value={form.address}
              onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))}
              error={fieldErrors.address}
              disabled={!canUpdate}
            />
            <Input
              label="USD to Kwacha rate (ZMW per 1 USD)"
              name="usdToZmwRate"
              type="number"
              min="0.0001"
              step="0.01"
              value={form.usdToZmwRate}
              onChange={(e) =>
                setForm((current) => ({ ...current, usdToZmwRate: e.target.value }))
              }
              error={fieldErrors.usdToZmwRate}
              disabled={!canUpdate}
              hint="Customers can switch display currency using this rate. Example: 18.5 means K18.50 = $1."
              required
            />
            {canUpdate ? (
              <Button type="submit" loading={saving}>
                Save settings
              </Button>
            ) : (
              <Alert tone="info">You can view these settings but cannot change them.</Alert>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
}
