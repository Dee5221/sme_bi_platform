import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as saleService from '../services/saleService';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import './SalesPage.css';

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [sale, setSale] = useState<saleService.Sale | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSale() {
      if (!id) return;
      try {
        setLoading(true);
        const data = await saleService.getSale(Number(id));
        setSale(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load sale details');
      } finally {
        setLoading(false);
      }
    }
    loadSale();
  }, [id]);

  if (loading) {
    return (
      <div className="sales-page">
        <div className="sales-header">
          <h1 className="sales-title">Sale Details</h1>
        </div>
        <Card><LoadingSkeleton rows={8} /></Card>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="sales-page">
        <div className="sales-header">
          <h1 className="sales-title">Sale Details</h1>
        </div>
        <div className="sales-alert sales-alert--error">{error || 'Sale not found'}</div>
        <Link to="/app/sales"><Button>Back to History</Button></Link>
      </div>
    );
  }

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1 className="sales-title">Sale #{sale.id}</h1>
          <p className="sales-subtitle">
            {new Date(sale.sale_datetime).toLocaleString('en-ZM', {
              year: 'numeric', month: 'long', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
        <Link to="/app/sales">
          <Button>Back to History</Button>
        </Link>
      </div>

      <div className="sale-detail-grid">
        <Card className="sale-detail-info">
          <h2 className="sale-detail-section-title">Transaction Info</h2>
          <div className="sale-detail-row">
            <span className="sale-detail-label">Status</span>
            <Badge tone={sale.status === 'completed' ? 'green' : 'neutral'}>{sale.status}</Badge>
          </div>
          <div className="sale-detail-row">
            <span className="sale-detail-label">Customer</span>
            <span>{sale.customer?.name || 'Walk-in Customer'}</span>
          </div>
          <div className="sale-detail-row">
            <span className="sale-detail-label">Payment Method</span>
            <span>{sale.payment_method}</span>
          </div>
          <div className="sale-detail-row">
            <span className="sale-detail-label">Recorded By</span>
            <span>{sale.user?.name || 'System'}</span>
          </div>
        </Card>

        <Card className="sale-detail-items">
          <h2 className="sale-detail-section-title">Items Sold</h2>
          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="sales-table-th--right">Price</th>
                  <th className="sales-table-th--right">Qty</th>
                  <th className="sales-table-th--right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product?.name || `Product #${item.product_id}`}</td>
                    <td className="sales-table-td--right">
                      K{Number(item.unit_price).toFixed(2)}
                    </td>
                    <td className="sales-table-td--right">{item.quantity}</td>
                    <td className="sales-table-td--right sales-table-td--bold">
                      K{Number(item.subtotal).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="sales-table-td--right" style={{ fontWeight: 700, fontSize: '16px' }}>
                    Total:
                  </td>
                  <td className="sales-table-td--right" style={{ fontWeight: 700, fontSize: '16px' }}>
                    K{Number(sale.total_amount).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}