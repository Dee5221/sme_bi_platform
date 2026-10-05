import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import './SalesPage.css';

export function SalesPage() {
  return (
    <div className="sales-page">
      <div className="page-header">
        <div className="page-header__content">
          <h1 className="page-title">Sales</h1>
          <p className="page-subtitle">
            Manage retail transactions and review sales activity.
          </p>
        </div>
      </div>

      <div className="sales-landing-grid">
        <Card className="sales-landing-card">
          <div className="sales-landing-icon sales-landing-icon--primary">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <h2 className="sales-landing-title">New Sale</h2>
          <p className="sales-landing-description">
            Open the point-of-sale terminal to record a new transaction.
          </p>
          <Link to="/app/sales/new">
            <Button>Open POS</Button>
          </Link>
        </Card>

        <Card className="sales-landing-card">
          <div className="sales-landing-icon sales-landing-icon--secondary">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v5h5" />
              <path d="M3.05 13A9 9 0 106 5.3L3 8" />
              <path d="M12 7v5l4 2" />
            </svg>
          </div>
          <h2 className="sales-landing-title">Sales History</h2>
          <p className="sales-landing-description">
            Browse, filter and review all completed sales transactions.
          </p>
          <Link to="/app/sales/history">
            <Button>View History</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}