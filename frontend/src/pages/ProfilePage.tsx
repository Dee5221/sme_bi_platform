import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError, mediaUrl } from '../lib/api';
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
  phone: string;
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

function mapFieldErrors(details: unknown): Record<string, string> {
  const next: Record<string, string> = {};
  if (!Array.isArray(details)) return next;
  for (const item of details as { path?: string; message?: string }[]) {
    if (item.path && item.message) next[item.path] = item.message;
  }
  return next;
}

export function ProfilePage() {
  const { user, setUser, hasPermission } = useAuth();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPassword);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [profileFieldErrors, setProfileFieldErrors] = useState<Record<string, string>>({});
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const canView = hasPermission('profile.view');
  const canUpdate = hasPermission('profile.update');

  useEffect(() => {
    let active = true;
    (async () => {
      if (!canView) {
        setLoadError('You do not have permission to view this profile.');
        setLoading(false);
        return;
      }
      try {
        const result = await profileApi.fetchProfile();
        if (!active) return;
        setUser(result.user);
        setProfileForm({
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          email: result.user.email,
          phone: result.user.phone || '',
        });
        setLoadError(null);
      } catch (err) {
        if (!active) return;
        setLoadError(
          err instanceof ApiClientError
            ? err.message
            : 'Unable to load profile.'
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [canView, setUser]);

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
        phone: profileForm.phone || undefined,
      });
      setUser(result.user);
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
    setPasswordError(null);
    setPasswordFieldErrors({});
    setSavingPassword(true);
    try {
      await profileApi.changePassword(passwordForm);
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

  async function onAvatarSelected(file: File | null) {
    if (!file || !canUpdate) return;
    setAvatarError(null);
    setUploadingAvatar(true);
    try {
      const result = await profileApi.uploadAvatar(file);
      setUser(result.user);
      pushToast('Profile photo updated.', 'success');
    } catch (err) {
      setAvatarError(
        err instanceof ApiClientError ? err.message : 'Unable to upload profile photo.'
      );
    } finally {
      setUploadingAvatar(false);
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

  const avatarSrc = mediaUrl(user.avatarUrl);
  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();

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
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="profile-avatar__image" />
              ) : (
                <span>{initials || 'U'}</span>
              )}
            </div>
            <div className="profile-avatar__meta">
              <strong>
                {user.firstName} {user.lastName}
              </strong>
              <span>{user.email}</span>
              {canUpdate ? (
                <label className="profile-avatar__upload">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={uploadingAvatar}
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      event.target.value = '';
                      void onAvatarSelected(file);
                    }}
                  />
                  <span>{uploadingAvatar ? 'Uploading…' : 'Upload photo'}</span>
                </label>
              ) : null}
              {avatarError ? <Alert tone="error">{avatarError}</Alert> : null}
            </div>
          </div>
          <dl className="profile-summary">
            <div>
              <dt>Business</dt>
              <dd>{user.business.name}</dd>
            </div>
            <div>
              <dt>Roles</dt>
              <dd className="profile-chips">
                {user.roles.map((role) => (
                  <Badge key={role} tone="blue">
                    {role}
                  </Badge>
                ))}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <Badge tone={user.isActive ? 'green' : 'red'}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </Badge>
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
                error={profileFieldErrors.firstName}
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
                error={profileFieldErrors.lastName}
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
            <Input
              label="Phone"
              name="phone"
              value={profileForm.phone}
              onChange={(e) =>
                setProfileForm((current) => ({ ...current, phone: e.target.value }))
              }
              error={profileFieldErrors.phone}
              disabled={!canUpdate}
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
                error={passwordFieldErrors.currentPassword}
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
                error={passwordFieldErrors.newPassword}
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
                error={passwordFieldErrors.confirmPassword}
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
