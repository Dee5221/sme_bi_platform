import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as inventoryApi from '../services/inventoryService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Input } from '../components/ui/Input';
import './inventory.css';

interface StockMovement {
  id: number;
  product_id: number;
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reference?: string | null;
  reason?: string | null;
  created_at: string;
  product?: {
    id: number;
    name: string;
    sku: string;
  };
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

const ITEMS_PER_PAGE = 20;

export function InventoryMovementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Get filter params from URL
  const productId = searchParams.get('product_id');
  const movementType = searchParams.get('movement_type');
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  // Client-side filtering
  const filteredMovements = movements.filter((m) => {
    if (productId && m.product_id !== parseInt(productId, 10)) return false;
    if (movementType && m.movement_type !== movementType) return false;
    return true;
  });

  // Client-side pagination
  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / ITEMS_PER_PAGE));
  const paginatedMovements = filteredMovements.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    loadMovements();
  }, []);

  async function loadMovements() {
    try {
      setLoading(true);
      setError(null);
      // Backend doesn't support pagination - fetch all and paginate client-side
      const data = await inventoryApi.listMovements({});
      const items = Array.isArray(data) ? data : (data as any)?.items || [];
      setMovements(items);
    } catch (err: any) {
      setError(err.message || 'Failed to load movements');
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to page 1 when filters change
    params.set('page', '1');
    setSearchParams(params);
  }

  function handlePageChange(page: number) {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    setSearchParams(params);
  }

  function getMovementTypeBadge(type: string) {
    switch (type) {
      case 'IN':
        return <Badge tone="green">IN</Badge>;
      case 'OUT':
        return <Badge tone="red">OUT</Badge>;
      case 'ADJUSTMENT':
        return <Badge tone="orange">ADJUSTMENT</Badge>;
      default:
        return <Badge tone="neutral">{type}</Badge>;
    }
  }

  if (loading) {
    return (
      <div className="inventory-page">
        <div className="inventory-header">
          <h1 className="inventory-title">Stock Movements</h1>
        </div>
        <Card>
          <LoadingSkeleton rows={10} />
        </Card>
      </div>
    );
  }

  return (
    <div className="inventory-page">
      <div className="inventory-header">
        <div>
          <h1 className="inventory-title">Stock Movements</h1>
          <p className="inventory-subtitle">
            Track all inventory movements and stock changes
          </p>
        </div>
        <Link to="/app/inventory">
          <Button>Back to Inventory</Button>
        </Link>
      </div>

      {error && (
        <div className="inventory-alert inventory-alert--error">
          {error}
        </div>
      )}

      {/* Filters */}
      <Card className="inventory-filters">
        <div className="inventory-filter-grid">
          <Input
            label="Product ID"
            type="number"
            value={productId || ''}
            onChange={(e) => handleFilterChange('product_id', e.target.value)}
            placeholder="Filter by product"
          />
          <div className="inventory-filter-field">
            <label className="inventory-filter-label">Movement Type</label>
            <select
              className="inventory-filter-select"
              value={movementType || ''}
              onChange={(e) => handleFilterChange('movement_type', e.target.value)}
            >
              <option value="">All Types</option>
              <option value="IN">Stock In</option>
              <option value="OUT">Stock Out</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Movements Table */}
      <Card>
        {paginatedMovements.length === 0 ? (
          <div className="inventory-empty">
            <p>No stock movements found</p>
          </div>
        ) : (
          <>
            <div className="inventory-table-wrapper">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Reference</th>
                    <th>Reason</th>
                    <th>User</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMovements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="inventory-table-td--muted">
                        {new Date(movement.created_at).toLocaleString('en-ZM', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td>
                        <div className="inventory-product-cell">
                          <div className="inventory-product-name">
                            {movement.product?.name || `Product #${movement.product_id}`}
                          </div>
                          {movement.product?.sku && (
                            <div className="inventory-product-sku">
                              {movement.product.sku}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{getMovementTypeBadge(movement.movement_type)}</td>
                      <td className="inventory-table-td--bold">
                        {movement.quantity}
                      </td>
                      <td className="inventory-table-td--muted">
                        {movement.reference || '—'}
                      </td>
                      <td className="inventory-table-td--muted">
                        {movement.reason || '—'}
                      </td>
                      <td className="inventory-table-td--muted">
                        {movement.user?.name || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="inventory-pagination">
                <div className="inventory-pagination-info">
                  Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredMovements.length)} to{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredMovements.length)} of{' '}
                  {filteredMovements.length} movements
                </div>
                <div className="inventory-pagination-controls">
                  <Button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="inventory-pagination-page">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}