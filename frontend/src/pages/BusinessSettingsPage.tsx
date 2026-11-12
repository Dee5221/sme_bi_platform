import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
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

const CURRENCIES = [
  { value: 'ZMW', label: 'Zambian Kwacha (ZMW)' },
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'ZAR', label: 'South African Rand (ZAR)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
];

type BusinessForm = {
  name: string;
  type: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  currency: string;
  report_header: string;
  receipt_footer: string;
};

function emptyForm(): BusinessForm {
  return {
    name: '',
    type: '',
    contact: '',
    email: '',
    phone: '',
    address: '',
    currency: 'ZMW',
    report_header: '',
    receipt_footer: '',
  };
}

function toForm(business: BusinessSettings): BusinessForm {
  return {
    name: business.name || '',
    type: business.type || '',
    contact: business.contact || '',
    email: business.email || '',
    phone: business.phone || '',
    address: business.address || '',
    currency: business.currency || 'ZMW',
    report_header: business.report_header || '',
    receipt_footer: business.receipt_footer || '',
  };
}

function mapFieldErrors(details: unknown): Record<string, string> {
  const next: Record<string, string> = {};
  if (!Array.isArray(details)) return next;
  for (const item of details as { loc?: string[]; msg?: string }[]) {
    if (item.loc && item.msg) {
      const fieldName = item.loc[item.loc.length - 1];
      next[fieldName] = item.msg;
    }
  }
  return next;
}

function formatDate(value: string | null) {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not recorded';
  return parsed.toLocaleString();
}

export function BusinessSettingsPage() {
  const { hasPermission } = useAuth();
  const { pushToast } = useToast();
  const canManage = hasPermission('business.settings.manage');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [form, setForm] = useState<BusinessForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!canManage) {
        setLoadError('You do not have permission to view business settings.');
        setLoading(false);
        return;
      }
      try {
        const result = await businessApi.fetchBusiness();
        if (!active) return;
        setBusiness(result);
        setForm(toForm(result));
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
  }, [canManage]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setFormError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      const result = await businessApi.updateBusiness({
        name: form.name.trim(),
        type: form.type.trim(),
        contact: form.contact.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim(),
        currency: form.currency,
        report_header: form.report_header.trim() || null,
        receipt_footer: form.receipt_footer.trim() || null,
      });
      setBusiness(result);
      setForm(toForm(result));
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

  if (!canManage) {
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
        subtitle="Name and contact details used on receipts and reports."
      />

      <div className="business-settings-grid">
        <Card title="Workspace profile">
          <dl className="business-settings-summary">
            <div>
              <dt>Business</dt>
              <dd>{business.name}</dd>
            </div>
            <div>
              <dt>Currency display</dt>
              <dd>
                <Badge tone="blue">{business.currency || 'ZMW'}</Badge>
              </dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(business.created_at)}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{formatDate(business.updated_at)}</dd>
            </div>
          </dl>
          <p className="business-settings-hint">
            Only the Business Owner can change these settings. Amounts already recorded are not
            converted when the display currency changes.
          </p>
        </Card>

        <Card title="Business details">
          <form className="business-settings-form" onSubmit={onSave} noValidate>
            {formError ? <Alert tone="error">{formError}</Alert> : null}
            <Input
              label="Business name"
              name="name"
              value={form.name}
              onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
              error={fieldErrors.name}
              required
            />
            <div className="business-settings-form__row">
              <Input
                label="Business type"
                name="type"
                value={form.type}
                onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))}
                error={fieldErrors.type}
                required
              />
              <Input
                label="Primary contact"
                name="contact"
                value={form.contact}
                onChange={(e) => setForm((current) => ({ ...current, contact: e.target.value }))}
                error={fieldErrors.contact}
                required
              />
            </div>
            <div className="business-settings-form__row">
              <Input
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                error={fieldErrors.email}
              />
              <Input
                label="Phone"
                name="phone"
                value={form.phone}
                onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                error={fieldErrors.phone}
              />
            </div>
            <Input
              label="Address"
              name="address"
              value={form.address}
              onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))}
              error={fieldErrors.address}
              required
            />
            <label className="business-settings-select">
              <span>Display currency</span>
              <select
                name="currency"
                value={form.currency}
                onChange={(e) => setForm((current) => ({ ...current, currency: e.target.value }))}
              >
                {CURRENCIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {fieldErrors.currency ? (
                <span className="ui-field__error">{fieldErrors.currency}</span>
              ) : (
                <span className="business-settings-hint">
                  Labels amounts on reports. It does not convert historical figures or apply an
                  exchange rate.
                </span>
              )}
            </label>
            <Input
              label="Report header"
              name="report_header"
              value={form.report_header}
              onChange={(e) =>
                setForm((current) => ({ ...current, report_header: e.target.value }))
              }
              error={fieldErrors.report_header}
              hint="Shown at the top of PDF reports. The business name is used if this is empty."
            />
            <Input
              label="Receipt footer"
              name="receipt_footer"
              value={form.receipt_footer}
              onChange={(e) =>
                setForm((current) => ({ ...current, receipt_footer: e.target.value }))
              }
              error={fieldErrors.receipt_footer}
              hint="Printed in the footer of generated reports."
            />
            <Button type="submit" loading={saving}>
              Save settings
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
