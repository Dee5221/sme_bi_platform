import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import './HomePage.css';

export function HomePage() {
  const { user, hasPermission } = useAuth();

  if (!user) return null;

  return (
    <div className="home-page">
      <PageHeader
        title={`Welcome, ${user.firstName}`}
        subtitle="Foundation is active. Your session and permissions are loaded from the API."
      />

      <div className="home-grid">
        <Card title="Business context">
          <dl className="home-dl">
            <div>
              <dt>Business</dt>
              <dd>{user.business.name}</dd>
            </div>
            <div>
              <dt>Account</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Roles</dt>
              <dd className="home-chips">
                {user.roles.map((role) => (
                  <Badge key={role} tone="blue">
                    {role}
                  </Badge>
                ))}
              </dd>
            </div>
          </dl>
        </Card>

        <Card title="Security status">
          <ul className="home-list">
            <li>Authenticated session via HTTP-only cookie</li>
            <li>Business ID derived from your account (not client-supplied)</li>
            <li>
              Dashboard access:{' '}
              {hasPermission('dashboard.view') ? (
                <Badge tone="green">granted</Badge>
              ) : (
                <Badge tone="red">missing</Badge>
              )}
            </li>
            <li>
              Profile access:{' '}
              {hasPermission('profile.view') ? (
                <Badge tone="green">granted</Badge>
              ) : (
                <Badge tone="red">missing</Badge>
              )}
            </li>
          </ul>
        </Card>

        <Card title="Assigned permissions" className="home-span">
          <div className="home-chips">
            {user.permissions.map((permission) => (
              <Badge key={permission}>{permission}</Badge>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
