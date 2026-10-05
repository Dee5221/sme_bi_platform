import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as productService from '../services/productService';
import * as customerService from '../services/customerService';
import * as saleService from '../services/saleService';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ApiClientError } from '../lib/api';
import './SalesPage.css';

interface CartItem {
  product: any;
  quantity: number;
}

export function NewSalePage() {
  const navigate = useNavigate();
  const { pushToast } = useToast();

  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [searchQuery, setSearchQuery] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [prods, custs] = await Promise.all([
          productService.listProducts({ status: 'active' }).catch(() => []),
          customerService.listCustomers({}).catch(() => []),
        ]);

        const prodList = Array.isArray(prods) ? prods : (prods as any)?.items || [];
        const custList = Array.isArray(custs) ? custs : (custs as any)?.items || [];

        setProducts(prodList);
        setCustomers(custList);
      } catch (err) {
        console.error('Failed to load POS data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
    );
  }, [products, searchQuery]);

  // Display-only total — backend is authoritative
  const cartDisplayTotal = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + Number(item.product.selling_price || 0) * item.quantity,
      0
    );
  }, [cart]);

  const cartItemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  function addToCart(product: any) {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function updateQuantity(productId: number, quantity: number) {
    if (isNaN(quantity) || quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  }

  function removeFromCart(productId: number) {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }

  function clearCart() {
    setCart([]);
    setSelectedCustomerId(null);
    setPaymentMethod('Cash');
    setSubmitError(null);
  }

  async function handleCheckout() {
    setSubmitError(null);

    if (cart.length === 0) {
      setSubmitError('Cart is empty. Add at least one product to proceed.');
      return;
    }

    const invalidItem = cart.find(
      (item) => !item.product?.id || item.quantity <= 0 || isNaN(item.quantity)
    );
    if (invalidItem) {
      setSubmitError(
        `Invalid quantity for ${invalidItem.product?.name || 'a product'}.`
      );
      return;
    }

    setSubmitting(true);
    try {
      // Build payload — matches backend contract exactly
      const payload: saleService.CreateSalePayload = {
        payment_method: paymentMethod,
        items: cart.map((item) => ({
          product_id: Number(item.product.id),
          quantity: Number(item.quantity),
        })),
      };

      // customer_id is optional — only include if selected
      if (selectedCustomerId !== null) {
        payload.customer_id = Number(selectedCustomerId);
      }

      await saleService.createSale(payload);

      pushToast('Sale completed successfully.', 'success');
      // Clear cart only AFTER success
      clearCart();
      navigate('/app/sales/history');
    } catch (err: any) {
      // Preserve cart on failure so user can retry
      let message = 'Unable to complete sale. Please try again.';

      if (err instanceof ApiClientError) {
        // Extract useful backend error message
        const details = err.details;
        if (Array.isArray(details) && details.length > 0) {
          const firstMsg = details[0]?.msg || details[0]?.message;
          if (firstMsg) message = firstMsg;
        } else if (err.message) {
          message = err.message;
        }

        // Friendly rewrites for common cases
        const lower = message.toLowerCase();
        if (lower.includes('stock') || lower.includes('inventory')) {
          message = 'Insufficient stock is available for one or more selected products.';
        } else if (lower.includes('customer')) {
          message = 'The selected customer could not be found. Please choose a different customer.';
        } else if (lower.includes('product')) {
          message = 'One or more products are unavailable. Please review your cart.';
        }
      }

      setSubmitError(message);
      pushToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="sales-page">
        <div className="page-header">
          <div className="page-header__content">
            <h1 className="page-title">New Sale</h1>
            <p className="page-subtitle">Point of Sale Terminal</p>
          </div>
        </div>
        <Card>
          <LoadingSkeleton rows={10} />
        </Card>
      </div>
    );
  }

  return (
    <div className="sales-page">
      <div className="page-header">
        <div className="page-header__content">
          <h1 className="page-title">New Sale</h1>
          <p className="page-subtitle">Select products and complete the transaction.</p>
        </div>
        <div className="page-header__actions">
          <Button onClick={() => navigate('/app/sales/history')}>
            Sales History
          </Button>
        </div>
      </div>

      <div className="pos-layout">
        {/* Left: Products */}
        <div className="pos-products-panel">
          <Card>
            <div className="pos-search">
              <Input
                type="text"
                placeholder="Search products by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} label={''}              />
            </div>

            <div className="pos-product-grid">
              {filteredProducts.length === 0 ? (
                <div className="pos-empty">No products match your search.</div>
              ) : (
                filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="pos-product-card"
                    onClick={() => addToCart(product)}
                  >
                    <div className="pos-product-name">{product.name}</div>
                    <div className="pos-product-sku">{product.sku}</div>
                    <div className="pos-product-price">
                      K{Number(product.selling_price || 0).toFixed(2)}
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right: Cart */}
        <div className="pos-cart-panel">
          <Card className="pos-cart-card">
            <h2 className="pos-cart-title">
              Current Sale
              {cartItemCount > 0 && (
                <span className="pos-cart-count">{cartItemCount}</span>
              )}
            </h2>

            <div className="pos-cart-items">
              {cart.length === 0 ? (
                <div className="pos-cart-empty">
                  Cart is empty. Click a product to add it.
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="pos-cart-item">
                    <div className="pos-cart-item-info">
                      <div className="pos-cart-item-name">{item.product.name}</div>
                      <div className="pos-cart-item-price">
                        K{Number(item.product.selling_price || 0).toFixed(2)} each
                      </div>
                    </div>
                    <div className="pos-cart-item-controls">
                      <button
                        type="button"
                        className="pos-qty-btn"
                        onClick={() =>
                          updateQuantity(item.product.id, item.quantity - 1)
                        }
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        className="pos-qty-input"
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(item.product.id, Number(e.target.value))
                        }
                        min="1"
                        aria-label={`Quantity for ${item.product.name}`}
                      />
                      <button
                        type="button"
                        className="pos-qty-btn"
                        onClick={() =>
                          updateQuantity(item.product.id, item.quantity + 1)
                        }
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="pos-remove-btn"
                        onClick={() => removeFromCart(item.product.id)}
                        aria-label={`Remove ${item.product.name}`}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="pos-cart-item-subtotal">
                      K{
                        (Number(item.product.selling_price || 0) * item.quantity).toFixed(2)
                      }
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pos-cart-summary">
              <div className="pos-summary-row">
                <span>Items:</span>
                <span>{cartItemCount}</span>
              </div>
              <div className="pos-summary-row pos-summary-total">
                <span>Estimated Total:</span>
                <span>K{cartDisplayTotal.toFixed(2)}</span>
              </div>
              <div className="pos-summary-note">
                Final total calculated by the system at checkout.
              </div>
            </div>

            <div className="pos-checkout-form">
              <div className="pos-form-field">
                <label className="pos-form-label" htmlFor="pos-customer">
                  Customer (optional)
                </label>
                <select
                  id="pos-customer"
                  className="pos-form-select"
                  value={selectedCustomerId ?? ''}
                  onChange={(e) =>
                    setSelectedCustomerId(
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                >
                  <option value="">Walk-in Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pos-form-field">
                <label className="pos-form-label" htmlFor="pos-payment">
                  Payment Method
                </label>
                <select
                  id="pos-payment"
                  className="pos-form-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Mobile Money">Mobile Money</option>
                </select>
              </div>

              {submitError && (
                <div className="pos-error-alert" role="alert">
                  {submitError}
                </div>
              )}

              <div className="pos-checkout-actions">
                <Button
                  onClick={clearCart}
                  disabled={submitting || cart.length === 0}
                >
                  Clear
                </Button>
                <Button
                  onClick={handleCheckout}
                  loading={submitting}
                  disabled={cart.length === 0}
                >
                  {submitting ? 'Processing...' : 'Complete Sale'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}