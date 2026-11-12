import { Link } from 'react-router-dom';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';

export function AccessDeniedPage() {
  return (
    <div>
      <PageHeader
        title="Access denied"
        subtitle="Your account does not have permission to view this page."
      />
      <Card>
        <Alert tone="error" title="Not authorised">
          If you need this function, ask the business owner to assign the correct role.
        </Alert>
        <div style={{ marginTop: '1rem' }}>
          <Link to="/app">
            <Button>Back to dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
