import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as inventoryApi from '../services/inventoryService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Input } from '../components/ui/Input';
import './inventory.css';

interface InventoryItem {
  id: number;
  product_id: number;
  quantity_on_hand: number;
  updated_at: string;
  product?: {
    id: number;
    name: string;
    sku: string;
    cost_price: number;
    selling_price: number;
    reorder_level: number;
    status: string;
    category?: {
      id: number;
      name: string;
    };
  };
}

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

const INVENTORY_PER_PAGE = 20;
const MOVEMENTS_PER_PAGE = 10;

export function OwnerInventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inventory' | 'movements'>('inventory');

  // Get filter params from URL
  const searchQuery = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || '';
  const categoryFilter = searchParams.get('category') || '';
  const stockFilter = searchParams.get('stock') || '';
  const inventoryPage = parseInt(searchParams.get('inventory_page') || '1', 10);
  const movementPage = parseInt(searchParams.get('movement_page') || '1', 10);

  // Client-side filtering for inventory
  const filteredInventory = inventory.filter((item) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        item.product?.name.toLowerCase().includes(query) ||
        item.product?.sku.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    if (statusFilter && item.product?.status !== statusFilter) return false;

    if (categoryFilter && item.product?.category?.name !== categoryFilter) return false;

    if (stockFilter) {
      const quantity = item.quantity_on_hand;
      const reorderLevel = item.product?.reorder_level || 0;

      switch (stockFilter) {
        case 'low':
          if (quantity > reorderLevel) return false;
          break;
        case 'out':
          if (quantity > 0) return false;
          break;
        case 'healthy':
          if (quantity <= reorderLevel) return false;
          break;
      }
    }

    return true;
  });

  // Client-side pagination for inventory
  const totalInventoryPages = Math.max(1, Math.ceil(filteredInventory.length / INVENTORY_PER_PAGE));
  const paginatedInventory = filteredInventory.slice(
    (inventoryPage - 1) * INVENTORY_PER_PAGE,
    inventoryPage * INVENTORY_PER_PAGE
  );

  // Client-side pagination for movements
  const totalMovementPages = Math.max(1, Math.ceil(movements.length / MOVEMENTS_PER_PAGE));
  const paginatedMovements = movements.slice(
    (movementPage - 1) * MOVEMENTS_PER_PAGE,
    movementPage * MOVEMENTS_PER_PAGE
  );

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Backend doesn't support pagination on movements - fetch all and paginate client-side
      const [inventoryData, movementsData] = await Promise.all([
        inventoryApi.listInventory({}),
        inventoryApi.listMovements({}),
      ]);

      setInventory(Array.isArray(inventoryData) ? inventoryData : (inventoryData as any)?.items || []);
      setMovements(Array.isArray(movementsData) ? movementsData : (movementsData as any)?.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory data');
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
    params.set('inventory_page', '1');
    setSearchParams(params);
  }

  function handleInventoryPageChange(page: number) {
    const params = new URLSearchParams(searchParams);
    params.set('inventory_page', page.toString());
    setSearchParams(params);
  }

  function handleMovementPageChange(page: number) {
    const params = new URLSearchParams(searchParams);
    params.set('movement_page', page.toString());
    setSearchParams(params);
  }

  function getStockStatus(item: InventoryItem) {
    const quantity = item.quantity_on_hand;
    const reorderLevel = item.product?.reorder_level || 0;

    if (quantity === 0) {
      return <Badge tone="red">Out of Stock</Badge>;
    } else if (quantity <= reorderLevel) {
      return <Badge tone="orange">Low Stock</Badge>;
    } else {
      return <Badge tone="green">In Stock</Badge>;
    }
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

  // Get unique categories for filter
  const categories = Array.from(
    new Set(
      inventory
        .map((item) => item.product?.category?.name)
        .filter((name): name is string => !!name)
    )
  ).sort();

  if (loading) {
    return (
      <div className="inventory-page">
        <div className="inventory-header">
          <h1 className="inventory-title">Inventory Management</h1>
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
          <h1 className="inventory-title">Inventory Management</h1>
          <p className="inventory-subtitle">
            Monitor stock levels and track inventory movements
          </p>
        </div>
        <div className="inventory-header-actions">
          <Link to="/app/inventory/movements">
            <Button>View All Movements</Button>
          </Link>
          <Link to="/app/inventory/adjust">
            <Button>Adjust Stock</Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="inventory-alert inventory-alert--error">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="inventory-tabs">
        <button
          className={`inventory-tab ${activeTab === 'inventory' ? 'inventory-tab--active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          Stock Levels ({filteredInventory.length})
        </button>
        <button
          className={`inventory-tab ${activeTab === 'movements' ? 'inventory-tab--active' : ''}`}
          onClick={() => setActiveTab('movements')}
        >
          Recent Movements ({movements.length})
        </button>
      </div>

      {activeTab === 'inventory' && (
        <>
          {/* Filters */}
          <Card className="inventory-filters">
            <div className="inventory-filter-grid">
              <Input
                label="Search"
                type="text"
                value={searchQuery}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search by name or SKU"
              />
              <div className="inventory-filter-field">
                <label className="inventory-filter-label">Status</label>
                <select
                  className="inventory-filter-select"
                  value={statusFilter}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="inventory-filter-field">
                <label className="inventory-filter-label">Category</label>
                <select
                  className="inventory-filter-select"
                  value={categoryFilter}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="inventory-filter-field">
                <label className="inventory-filter-label">Stock Level</label>
                <select
                  className="inventory-filter-select"
                  value={stockFilter}
                  onChange={(e) => handleFilterChange('stock', e.target.value)}
                >
                  <option value="">All Levels</option>
                  <option value="healthy">Healthy</option>
                  <option value="low">Low Stock</option>
                  <option value="out">Out of Stock</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Inventory Table */}
          <Card>
            {paginatedInventory.length === 0 ? (
              <div className="inventory-empty">
                <p>No inventory items found</p>
              </div>
            ) : (
              <>
                <div className="inventory-table-wrapper">
                  <table className="inventory-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th>SKU</th>
                        <th>Quantity</th>
                        <th>Reorder Level</th>
                        <th>Status</th>
                        <th>Last Updated</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedInventory.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="inventory-product-cell">
                              <div className="inventory-product-name">
                                {item.product?.name || `Product #${item.product_id}`}
                              </div>
                              <div className="inventory-product-prices">
                                Cost: K{(item.product?.cost_price || 0).toFixed(2)} |{' '}
                                Sell: K{(item.product?.selling_price || 0).toFixed(2)}
                              </div>
                            </div>
                          </td>
                          <td className="inventory-table-td--muted">
                            {item.product?.category?.name || '—'}
                          </td>
                          <td className="inventory-table-td--muted">
                            {item.product?.sku || '—'}
                          </td>
                          <td className="inventory-table-td--bold">
                            {item.quantity_on_hand}
                          </td>
                          <td className="inventory-table-td--muted">
                            {item.product?.reorder_level || 0}
                          </td>
                          <td>{getStockStatus(item)}</td>
                          <td className="inventory-table-td--muted">
                            {new Date(item.updated_at).toLocaleDateString('en-ZM', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td>
                            <Link
                              to={`/app/inventory/adjust?product_id=${item.product_id}`}
                              className="inventory-action-link"
                            >
                              Adjust
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalInventoryPages > 1 && (
                  <div className="inventory-pagination">
                    <div className="inventory-pagination-info">
                      Showing {Math.min((inventoryPage - 1) * INVENTORY_PER_PAGE + 1, filteredInventory.length)} to{' '}
                      {Math.min(inventoryPage * INVENTORY_PER_PAGE, filteredInventory.length)} of{' '}
                      {filteredInventory.length} items
                    </div>
                    <div className="inventory-pagination-controls">
                      <Button
                        onClick={() => handleInventoryPageChange(inventoryPage - 1)}
                        disabled={inventoryPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="inventory-pagination-page">
                        Page {inventoryPage} of {totalInventoryPages}
                      </span>
                      <Button
                        onClick={() => handleInventoryPageChange(inventoryPage + 1)}
                        disabled={inventoryPage === totalInventoryPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </>
      )}

      {activeTab === 'movements' && (
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
                          {movement.user?.name || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalMovementPages > 1 && (
                <div className="inventory-pagination">
                  <div className="inventory-pagination-info">
                    Showing {Math.min((movementPage - 1) * MOVEMENTS_PER_PAGE + 1, movements.length)} to{' '}
                    {Math.min(movementPage * MOVEMENTS_PER_PAGE, movements.length)} of{' '}
                    {movements.length} movements
                  </div>
                  <div className="inventory-pagination-controls">
                    <Button
                      onClick={() => handleMovementPageChange(movementPage - 1)}
                      disabled={movementPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="inventory-pagination-page">
                      Page {movementPage} of {totalMovementPages}
                    </span>
                    <Button
                      onClick={() => handleMovementPageChange(movementPage + 1)}
                      disabled={movementPage === totalMovementPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}