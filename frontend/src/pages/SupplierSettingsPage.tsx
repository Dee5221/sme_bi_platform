import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as settingsApi from '../services/supplierPortalSettingsService';
import type { SupplierPortalSettings } from '../services/supplierPortalSettingsService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/Toast';
import './BusinessSettingsPage.css';

type SettingsForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
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

export function SupplierSettingsPage() {
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();
  const canView = hasPermission('portal.settings.view');
  const canUpdate = hasPermission('portal.settings.update');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SupplierPortalSettings | null>(null);
  const [form, setForm] = useState<SettingsForm>({
    name: '',
    email: '',
    phone: '',
    address: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!canView) {
        setLoadError('You do not have permission to view portal settings.');
        setLoading(false);
        return;
      }
      try {
        const result = await settingsApi.fetchSupplierPortalSettings();
        if (!active) return;
        setSettings(result.settings);
        setForm({
          name: result.settings.supplier.name,
          email: result.settings.supplier.email || '',
          phone: result.settings.supplier.phone || '',
          address: result.settings.supplier.address || '',
        });
        setLoadError(null);
      } catch (err) {
        if (!active) return;
        setLoadError(
          err instanceof ApiClientError ? err.message : 'Unable to load portal settings.'
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
      const result = await settingsApi.updateSupplierPortalSettings({
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
      });
      setSettings(result.settings);
      pushToast('Portal settings updated.', 'success');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        setFieldErrors(mapFieldErrors(err.details));
      } else {
        setFormError('Unable to update portal settings.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (!canView) {
    return <Alert tone="error">You do not have permission to view portal settings.</Alert>;
  }

  if (loading) {
    return (
      <Card>
        <LoadingSkeleton rows={6} />
      </Card>
    );
  }

  if (loadError || !settings) {
    return <Alert tone="error">{loadError || 'Portal settings unavailable.'}</Alert>;
  }

  return (
    <div className="business-settings-page">
      <PageHeader
        title="Settings"
        subtitle="Manage the contact details this business keeps on file for your supplier account."
      />

      <div className="business-settings-grid">
        <Card title="Account status">
          <dl className="business-settings-summary">
            <div>
              <dt>Business</dt>
              <dd>{settings.business.name}</dd>
            </div>
            <div>
              <dt>Supplier status</dt>
              <dd>
                <Badge tone={settings.supplier.status === 'ACTIVE' ? 'green' : 'orange'}>
                  {settings.supplier.status}
                </Badge>
              </dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{formatDate(settings.supplier.updatedAt)}</dd>
            </div>
          </dl>
          <p className="business-settings-hint">
            Account login details are managed from Profile. Status changes are handled by the
            business.
          </p>
        </Card>

        <Card title="Contact details">
          <form className="business-settings-form" onSubmit={onSave} noValidate>
            {formError ? <Alert tone="error">{formError}</Alert> : null}
            <Input
              label="Name"
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
