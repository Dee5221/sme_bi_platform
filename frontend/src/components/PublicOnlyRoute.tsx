import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingSkeleton } from './ui/LoadingSkeleton';
import { Card } from './ui/Card';

export function PublicOnlyRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <Card>
          <LoadingSkeleton rows={3} />
        </Card>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}
