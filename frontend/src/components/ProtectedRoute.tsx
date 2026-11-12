import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AccessDeniedPage } from '../pages/AccessDeniedPage';
import { Card } from './ui/Card';
import { LoadingSkeleton } from './ui/LoadingSkeleton';

type Props = {
  permission?: string;
  anyOf?: string[];
};

export function ProtectedRoute({ permission, anyOf }: Props) {
  const { user, loading, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <Card>
          <LoadingSkeleton rows={4} />
        </Card>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const allowed = permission
    ? hasPermission(permission)
    : anyOf
      ? anyOf.some((key) => hasPermission(key))
      : true;

  if (!allowed) {
    return <AccessDeniedPage />;
  }

  return <Outlet />;
}
