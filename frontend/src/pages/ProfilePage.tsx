import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../lib/api';
import * as profileApi from '../services/profileService';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/Toast';
import './ProfilePage.css';

type ProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const emptyPassword: PasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

function splitName(name?: string | null): { firstName: string; lastName: string } {
  const trimmed = (name || '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const space = trimmed.indexOf(' ');
  if (space === -1) return { firstName: trimmed, lastName: '' };
  return { firstName: trimmed.slice(0, space), lastName: trimmed.slice(space + 1).trim() };
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

function roleLabel(user: {
  role?: { role_name?: string } | string | null;
  role_name?: string | null;
}): string {
  if (user.role_name) return user.role_name;
  if (user.role && typeof user.role === 'object' && user.role.role_name) {
    return user.role.role_name;
  }
  if (typeof user.role === 'string') return user.role;
  return 'Member';
}

export function ProfilePage() {
  const { user, hasPermission, refreshUser, applySessionToken } = useAuth();
  const { pushToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const initialNames = splitName(user?.name);
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    firstName: initialNames.firstName,
    lastName: initialNames.lastName,
    email: user?.email || '',
  });
  const [displayName, setDisplayName] = useState(user?.name || user?.email || '');
  const [accountStatus, setAccountStatus] = useState(user?.status || 'active');
  const [roleName, setRoleName] = useState(roleLabel(user || {}));

  const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPassword);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [profileFieldErrors, setProfileFieldErrors] = useState<Record<string, string>>({});
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const canView = hasPermission('profile.manage');
  const canUpdate = hasPermission('profile.manage');

  useEffect(() => {
    let active = true;
    (async () => {
      if (!canView) {
        setLoadError('You do not have permission to view this profile.');
        setLoading(false);
        return;
      }
      try {
        const profileData = await profileApi.fetchProfile();
        if (!active) return;

        const userData = profileData.user;
        const fromApi = splitName(userData.name);
        setProfileForm({
          firstName: userData.firstName || userData.first_name || fromApi.firstName,
          lastName: userData.lastName || userData.last_name || fromApi.lastName,
          email: userData.email || user?.email || '',
        });
        setDisplayName(userData.name || user?.name || userData.email);
        setAccountStatus(userData.status || 'active');
        setRoleName(roleLabel(userData));
        setLoadError(null);
      } catch (err) {
        if (!active) return;
        setLoadError(
          err instanceof ApiClientError ? err.message : 'Unable to load profile.'
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [canView, user]);

  async function onSaveProfile(event: FormEvent) {
    event.preventDefault();
    if (!canUpdate) return;
    setProfileError(null);
    setProfileFieldErrors({});
    setSavingProfile(true);
    try {
      const result = await profileApi.updateProfile({
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        email: profileForm.email,
      });
      setDisplayName(result.user.name);
      await refreshUser();
      pushToast('Profile updated.', 'success');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setProfileError(err.message);
        setProfileFieldErrors(mapFieldErrors(err.details));
      } else {
        setProfileError('Unable to update profile.');
      }
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(event: FormEvent) {
    event.preventDefault();
    if (!canUpdate) return;

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match.');
      setPasswordFieldErrors({ confirmPassword: 'Passwords do not match.' });
      return;
    }

    setPasswordError(null);
    setPasswordFieldErrors({});
    setSavingPassword(true);
    try {
      const result = await profileApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });
      if (result.access_token) {
        await applySessionToken(result.access_token);
      }
      setPasswordForm(emptyPassword);
      pushToast('Password updated.', 'success');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setPasswordError(err.message);
        setPasswordFieldErrors(mapFieldErrors(err.details));
      } else {
        setPasswordError('Unable to change password.');
      }
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <LoadingSkeleton rows={5} />
      </Card>
    );
  }

  if (loadError) {
    return <Alert tone="error">{loadError}</Alert>;
  }

  if (!user) return null;

  const initials =
    `${profileForm.firstName?.[0] || ''}${profileForm.lastName?.[0] || ''}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    'U';
  const statusTone = accountStatus === 'active' ? 'green' : 'orange';

  return (
    <div className="profile-page">
      <PageHeader
        title="Profile"
        subtitle="Manage your account details for this business workspace."
      />

      <div className="profile-grid">
        <Card title="Account summary">
          <div className="profile-avatar-block">
            <div className="profile-avatar" aria-hidden="true">
              <span>{initials}</span>
            </div>
            <div className="profile-avatar__meta">
              <strong>{displayName}</strong>
              <span>{profileForm.email}</span>
            </div>
          </div>
          <dl className="profile-summary">
            <div>
              <dt>Business ID</dt>
              <dd>{user.business_id || 'N/A'}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd className="profile-chips">
                <Badge tone="blue">{roleName}</Badge>
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <Badge tone={statusTone}>{accountStatus}</Badge>
              </dd>
            </div>
          </dl>
        </Card>

        <Card title="Personal details">
          <form className="profile-form" onSubmit={onSaveProfile} noValidate>
            {profileError ? <Alert tone="error">{profileError}</Alert> : null}
            <div className="profile-form__row">
              <Input
                label="First name"
                name="firstName"
                value={profileForm.firstName}
                onChange={(e) =>
                  setProfileForm((current) => ({ ...current, firstName: e.target.value }))
                }
                error={profileFieldErrors.firstName || profileFieldErrors.first_name}
                disabled={!canUpdate}
                required
              />
              <Input
                label="Last name"
                name="lastName"
                value={profileForm.lastName}
                onChange={(e) =>
                  setProfileForm((current) => ({ ...current, lastName: e.target.value }))
                }
                error={profileFieldErrors.lastName || profileFieldErrors.last_name}
                disabled={!canUpdate}
                required
              />
            </div>
            <Input
              label="Email"
              name="email"
              type="email"
              value={profileForm.email}
              onChange={(e) =>
                setProfileForm((current) => ({ ...current, email: e.target.value }))
              }
              error={profileFieldErrors.email}
              disabled={!canUpdate}
              required
            />
            {canUpdate ? (
              <Button type="submit" loading={savingProfile}>
                Save profile
              </Button>
            ) : (
              <Alert tone="warning">You do not have permission to update this profile.</Alert>
            )}
          </form>
        </Card>

        <Card title="Change password" className="profile-span">
          <form className="profile-form" onSubmit={onChangePassword} noValidate>
            {passwordError ? <Alert tone="error">{passwordError}</Alert> : null}
            <div className="profile-form__row profile-form__row--3">
              <Input
                label="Current password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm((current) => ({
                    ...current,
                    currentPassword: e.target.value,
                  }))
                }
                error={passwordFieldErrors.currentPassword || passwordFieldErrors.current_password}
                disabled={!canUpdate}
                required
              />
              <Input
                label="New password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm((current) => ({
                    ...current,
                    newPassword: e.target.value,
                  }))
                }
                error={passwordFieldErrors.newPassword || passwordFieldErrors.new_password}
                hint="At least 8 characters with a letter and a number."
                disabled={!canUpdate}
                required
              />
              <Input
                label="Confirm new password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm((current) => ({
                    ...current,
                    confirmPassword: e.target.value,
                  }))
                }
                error={passwordFieldErrors.confirmPassword || passwordFieldErrors.confirm_password}
                disabled={!canUpdate}
                required
              />
            </div>
            {canUpdate ? (
              <Button type="submit" loading={savingPassword}>
                Update password
              </Button>
            ) : null}
          </form>
        </Card>
      </div>
    </div>
  );
}
