import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { api } from '../services/api';
import { salesOrdersService, SalesOrder } from '../services/sales-orders.service';
import { CameraScannerModal } from '../components/CameraScannerModal';
import { useAuth } from '../auth/AuthContext';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  status?: string;
}

export interface Product {
  id: string;
  SKU: string;
  name: string;
  brand: string;
  model?: string;
  description?: string;
  MRP: number | string;
  price: number | string;
  tax?: number | string;
  IMEITracked: boolean;
  status: string;
}

export interface InventoryItem {
  id: string;
  IMEI: string;
  serialNumber: string;
  status: string;
  productId: string;
  warehouseId: string;
  partnerId: string;
}

export interface CartItem {
  productId: string;
  productName: string;
  sku: string;
  price: number;
  tax: number;
  imeiTracked: boolean;
  inventoryItemId?: string;
  imei?: string;
  quantity: number;
}

export const POSPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // State: Customer
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerLoading, setIsCustomerLoading] = useState(false);
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);

  // New Customer Form State
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [createCustomerError, setCreateCustomerError] = useState<string | null>(null);

  // State: Products
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // State: IMEIs & Inventory
  const [availableImeis, setAvailableImeis] = useState<InventoryItem[]>([]);
  const [isImeisLoading, setIsImeisLoading] = useState(false);
  const [selectedImei, setSelectedImei] = useState<string>('');
  const [manualImeiInput, setManualImeiInput] = useState<string>('');
  const [imeiValidationError, setImeiValidationError] = useState<string | null>(null);
  const [imeiSuccessMessage, setImeiSuccessMessage] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Non-IMEI Quantity
  const [nonImeiQty, setNonImeiQty] = useState<number>(1);

  // State: Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // State: Checkout & Modal
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // State: Sale Result
  const [saleResult, setSaleResult] = useState<SalesOrder | null>(null);

  useEffect(() => {
    fetchCustomers();
    fetchProducts();
  }, []);

  const fetchCustomers = async () => {
    setIsCustomerLoading(true);
    try {
      const res = await api.get<Customer[]>('/customers');
      setCustomers(res || []);
    } catch (err: any) {
      console.error('Failed to load customers:', err);
    } finally {
      setIsCustomerLoading(false);
    }
  };

  const fetchProducts = async () => {
    setIsProductsLoading(true);
    try {
      const res = await api.get<Product[]>('/products');
      setProducts(res || []);
    } catch (err: any) {
      console.error('Failed to load products:', err);
    } finally {
      setIsProductsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProduct && selectedProduct.IMEITracked) {
      fetchAvailableImeis(selectedProduct.id);
    } else {
      setAvailableImeis([]);
      setSelectedImei('');
      setManualImeiInput('');
      setImeiValidationError(null);
      setImeiSuccessMessage(null);
    }
  }, [selectedProduct]);

  const fetchAvailableImeis = async (productId: string) => {
    setIsImeisLoading(true);
    setImeiValidationError(null);
    try {
      const res = await api.get<InventoryItem[]>(`/inventory/items?productId=${productId}`);
      const available = (res || []).filter((item) => item.status === 'AVAILABLE');
      setAvailableImeis(available);
    } catch (err: any) {
      setImeiValidationError('Failed to fetch available IMEIs for this product');
    } finally {
      setIsImeisLoading(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateCustomerError(null);
    if (!newCustName.trim() || !newCustPhone.trim()) {
      setCreateCustomerError('Customer Name and Phone number are required');
      return;
    }

    setIsCreatingCustomer(true);
    try {
      const created = await api.post<Customer>('/customers', {
        name: newCustName.trim(),
        phone: newCustPhone.trim(),
        email: newCustEmail.trim() || undefined,
        address: newCustAddress.trim() || undefined,
      });

      setSelectedCustomer(created);
      setShowCreateCustomerModal(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustEmail('');
      setNewCustAddress('');
      fetchCustomers();
    } catch (err: any) {
      setCreateCustomerError(err.message || 'Failed to create customer');
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const handleAddToCart = (imeiItem?: InventoryItem) => {
    if (!selectedProduct) return;

    const unitPrice = Number(selectedProduct.price) || Number(selectedProduct.MRP) || 0;
    const taxRate = Number(selectedProduct.tax) || 0;

    if (selectedProduct.IMEITracked) {
      const targetImeiItem = imeiItem || availableImeis.find((i) => i.IMEI === selectedImei || i.IMEI === manualImeiInput.trim());
      
      if (!targetImeiItem) {
        setImeiValidationError('Please select or enter a valid available IMEI');
        return;
      }

      const existsInCart = cart.some((c) => c.inventoryItemId === targetImeiItem.id || c.imei === targetImeiItem.IMEI);
      if (existsInCart) {
        setImeiValidationError(`IMEI ${targetImeiItem.IMEI} is already in the cart`);
        return;
      }

      const newCartItem: CartItem = {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        sku: selectedProduct.SKU,
        price: unitPrice,
        tax: taxRate,
        imeiTracked: true,
        inventoryItemId: targetImeiItem.id,
        imei: targetImeiItem.IMEI,
        quantity: 1,
      };

      setCart((prev) => [...prev, newCartItem]);
      setImeiSuccessMessage(`Added IMEI ${targetImeiItem.IMEI} to cart`);
      setImeiValidationError(null);
      setSelectedImei('');
      setManualImeiInput('');
    } else {
      if (nonImeiQty < 1) return;

      const existingIdx = cart.findIndex((c) => c.productId === selectedProduct.id && !c.imeiTracked);
      if (existingIdx > -1) {
        setCart((prev) => {
          const updated = [...prev];
          updated[existingIdx].quantity += nonImeiQty;
          return updated;
        });
      } else {
        const newCartItem: CartItem = {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          sku: selectedProduct.SKU,
          price: unitPrice,
          tax: taxRate,
          imeiTracked: false,
          quantity: nonImeiQty,
        };
        setCart((prev) => [...prev, newCartItem]);
      }
      setNonImeiQty(1);
    }
  };

  const handleValidateAndAddManualImei = () => {
    setImeiValidationError(null);
    setImeiSuccessMessage(null);

    const trimmed = manualImeiInput.trim();
    if (!trimmed) {
      setImeiValidationError('Please enter an IMEI number');
      return;
    }

    if (!selectedProduct) {
      setImeiValidationError('Please select a product first');
      return;
    }

    const match = availableImeis.find((i) => i.IMEI === trimmed);
    if (!match) {
      setImeiValidationError(`IMEI '${trimmed}' not found or not available for this product`);
      return;
    }

    handleAddToCart(match);
  };

  const handleScanSuccess = (scannedText: string) => {
    setIsScannerOpen(false);
    setManualImeiInput(scannedText);
    setImeiValidationError(null);

    if (selectedProduct && selectedProduct.IMEITracked) {
      const match = availableImeis.find((i) => i.IMEI === scannedText);
      if (match) {
        handleAddToCart(match);
      } else {
        setImeiValidationError(`Scanned IMEI '${scannedText}' is not available for product '${selectedProduct.name}'`);
      }
    }
  };

  const handleUpdateCartQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const target = updated[index];
      if (target.imeiTracked) return prev;

      const newQty = target.quantity + delta;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      target.quantity = newQty;
      return updated;
    });
  };

  const handleRemoveFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity * item.tax) / 100, 0);
  const grandTotal = subtotal + taxTotal;

  const handleConfirmSale = async () => {
    if (!selectedCustomer) {
      setCheckoutError('Please select a customer before checkout');
      return;
    }
    if (cart.length === 0) {
      setCheckoutError('Your cart is empty');
      return;
    }

    setIsSubmittingOrder(true);
    setCheckoutError(null);

    try {
      const payload = {
        customerId: selectedCustomer.id,
        lines: cart.map((item) => ({
          productId: item.productId,
          inventoryItemId: item.inventoryItemId,
          quantity: item.quantity,
        })),
      };

      const result = await salesOrdersService.createSalesOrder(payload);
      setSaleResult(result);
      setShowCheckoutConfirm(false);

      setCart([]);
      setSelectedCustomer(null);
      setSelectedProduct(null);
      setAvailableImeis([]);

      fetchProducts();
      fetchCustomers();
    } catch (err: any) {
      setCheckoutError(err.message || 'Failed to complete sale. Please check inventory stock.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch) ||
      (c.email && c.email.toLowerCase().includes(customerSearch.toLowerCase()))
  );

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.SKU.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.brand.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.model && p.model.toLowerCase().includes(productSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg text-blue-600">
              <Icons.Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">POS / Retail Sales</h1>
              <p className="text-xs text-gray-500">
                Point of Sale interface for customer sales & IMEI inventory dispatch
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/sales-orders')}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold border border-gray-300 transition shadow-sm"
          >
            <Icons.Receipt className="w-4 h-4 text-gray-500" />
            <span>Sales History</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Customer & Product Selection */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Customer Selection */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Icons.UserCheck className="w-4 h-4 text-blue-600" />
                1. Select Customer
              </h2>
              <button
                onClick={() => setShowCreateCustomerModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold transition"
              >
                <Icons.UserPlus className="w-3.5 h-3.5" />
                <span>+ Create Customer</span>
              </button>
            </div>

            {selectedCustomer ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-blue-900">{selectedCustomer.name}</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                      Selected
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 flex items-center gap-3">
                    <span>Phone: {selectedCustomer.phone}</span>
                    {selectedCustomer.email && <span>Email: {selectedCustomer.email}</span>}
                  </div>
                  {selectedCustomer.address && (
                    <div className="text-[11px] text-gray-500">Address: {selectedCustomer.address}</div>
                  )}
                </div>

                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-xs text-red-600 hover:text-red-700 px-3 py-1 bg-white border border-red-200 hover:bg-red-50 rounded-md font-semibold transition"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Icons.Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search customer by name, phone, email..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3.5 py-2 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600"
                  />
                </div>

                {isCustomerLoading ? (
                  <div className="text-xs text-gray-500 py-2 flex items-center gap-2">
                    <Icons.Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Loading customers...</span>
                  </div>
                ) : filteredCustomers.length > 0 ? (
                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                    {filteredCustomers.map((cust) => (
                      <div
                        key={cust.id}
                        onClick={() => setSelectedCustomer(cust)}
                        className="p-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between cursor-pointer transition shadow-sm"
                      >
                        <div>
                          <div className="text-xs font-bold text-gray-900">{cust.name}</div>
                          <div className="text-[11px] text-gray-500">{cust.phone} {cust.email ? `• ${cust.email}` : ''}</div>
                        </div>
                        <button className="text-xs px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md font-semibold border border-blue-200">
                          Select
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">
                    No customers found matching &quot;{customerSearch}&quot;. Use &quot;+ Create Customer&quot; above.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Product Search */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Icons.Package className="w-4 h-4 text-blue-600" />
                2. Select Product
              </h2>
            </div>

            <div className="relative">
              <Icons.Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search product by name, SKU, brand..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3.5 py-2 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600"
              />
            </div>

            {isProductsLoading ? (
              <div className="text-xs text-gray-500 py-4 flex items-center justify-center gap-2">
                <Icons.Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Loading product catalog...</span>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {filteredProducts.map((prod) => {
                  const isSelected = selectedProduct?.id === prod.id;
                  const displayPrice = Number(prod.price) || Number(prod.MRP) || 0;

                  return (
                    <div
                      key={prod.id}
                      onClick={() => setSelectedProduct(prod)}
                      className={`p-3 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-50 border-blue-300 text-blue-900 shadow-sm'
                          : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-800'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-900">{prod.name}</span>
                          <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                            {prod.SKU}
                          </span>
                          {prod.IMEITracked ? (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                              IMEI Tracked
                            </span>
                          ) : (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                              Batch
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Brand: <span className="text-gray-800 font-semibold">{prod.brand}</span> {prod.model ? `• Model: ${prod.model}` : ''}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-extrabold text-blue-700">₹{displayPrice.toLocaleString()}</div>
                        <span className="text-[10px] text-gray-400">Tier Price</span>
                      </div>
                    </div>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <div className="text-xs text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-lg">
                    No products found matching &quot;{productSearch}&quot;.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Selected Product Item Config */}
          {selectedProduct && (
            <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 flex items-center gap-2">
                    <Icons.Sliders className="w-4 h-4 text-blue-600" />
                    Item Config: <span className="text-blue-700">{selectedProduct.name}</span>
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    SKU: {selectedProduct.SKU} | Price: ₹{Number(selectedProduct.price || selectedProduct.MRP).toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedProduct.IMEITracked ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-700 uppercase">
                      Select or Scan IMEI
                    </label>

                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold transition"
                    >
                      <Icons.Camera className="w-3.5 h-3.5" />
                      <span>Scan Barcode / QR</span>
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-500 font-medium">Available IMEIs in warehouse stock:</label>
                    <select
                      value={selectedImei}
                      onChange={(e) => {
                        setSelectedImei(e.target.value);
                        setManualImeiInput(e.target.value);
                        setImeiValidationError(null);
                      }}
                      className="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg p-2 focus:outline-none focus:border-blue-600"
                    >
                      <option value="">-- Select available IMEI ({availableImeis.length}) --</option>
                      {availableImeis.map((item) => (
                        <option key={item.id} value={item.IMEI}>
                          {item.IMEI} (SN: {item.serialNumber})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-500 font-medium">Or enter IMEI manually:</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter 15-digit IMEI..."
                        value={manualImeiInput}
                        onChange={(e) => setManualImeiInput(e.target.value)}
                        className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600"
                      />
                      <button
                        type="button"
                        onClick={handleValidateAndAddManualImei}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm"
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>

                  {imeiValidationError && (
                    <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-lg flex items-center gap-2">
                      <Icons.AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{imeiValidationError}</span>
                    </div>
                  )}

                  {imeiSuccessMessage && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-lg flex items-center gap-2">
                      <Icons.CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{imeiSuccessMessage}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between pt-1">
                  <div className="space-y-0.5">
                    <label className="text-xs font-semibold text-gray-700 uppercase block">
                      Quantity Selection
                    </label>
                    <span className="text-[11px] text-gray-500">Non-IMEI product line</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-gray-300 rounded-lg bg-white">
                      <button
                        type="button"
                        onClick={() => setNonImeiQty((q) => Math.max(1, q - 1))}
                        className="px-3 py-1.5 text-gray-500 hover:text-gray-900"
                      >
                        -
                      </button>
                      <span className="px-3 text-xs font-bold text-gray-900 font-mono">{nonImeiQty}</span>
                      <button
                        type="button"
                        onClick={() => setNonImeiQty((q) => q + 1)}
                        className="px-3 py-1.5 text-gray-500 hover:text-gray-900"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddToCart()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm flex items-center gap-1.5"
                    >
                      <Icons.Plus className="w-4 h-4" />
                      <span>Add to Cart</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Cart Summary & Checkout */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4 text-xs sticky top-6">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Icons.ShoppingCart className="w-4 h-4 text-blue-600" />
                Cart ({cart.length} {cart.length === 1 ? 'item' : 'items'})
              </h2>

              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-gray-400 hover:text-red-600 transition font-semibold"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Cart Item Lines */}
            {cart.length > 0 ? (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {cart.map((item, index) => (
                  <div
                    key={`${item.productId}-${item.imei || index}`}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-bold text-gray-900">{item.productName}</div>
                        <div className="text-[10px] text-gray-500 font-mono">SKU: {item.sku}</div>
                        {item.imei && (
                          <div className="text-xs text-emerald-700 font-mono font-bold mt-0.5 flex items-center gap-1">
                            <Icons.QrCode className="w-3.5 h-3.5" />
                            <span>IMEI: {item.imei}</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleRemoveFromCart(index)}
                        className="text-gray-400 hover:text-red-600 p-1 transition"
                        title="Remove item"
                      >
                        <Icons.Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-gray-200 text-xs">
                      {item.imeiTracked ? (
                        <span className="text-gray-500 font-mono">Qty: 1</span>
                      ) : (
                        <div className="flex items-center border border-gray-300 rounded bg-white">
                          <button
                            onClick={() => handleUpdateCartQuantity(index, -1)}
                            className="px-2 py-0.5 text-gray-500 hover:text-gray-900"
                          >
                            -
                          </button>
                          <span className="px-2 font-mono font-bold text-gray-900">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateCartQuantity(index, 1)}
                            className="px-2 py-0.5 text-gray-500 hover:text-gray-900"
                          >
                            +
                          </button>
                        </div>
                      )}

                      <div className="text-gray-900 font-mono font-bold">
                        ₹{(item.price * item.quantity).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center border border-dashed border-gray-200 rounded-lg space-y-1">
                <Icons.ShoppingBag className="w-7 h-7 text-gray-400 mx-auto" />
                <p className="text-xs text-gray-500 font-medium">Your POS cart is currently empty.</p>
                <p className="text-[11px] text-gray-400">Select a product to begin adding sale lines.</p>
              </div>
            )}

            {/* Calculations Summary */}
            {cart.length > 0 && (
              <div className="pt-3 border-t border-gray-200 space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-mono text-gray-900">₹{subtotal.toLocaleString()}</span>
                </div>
                {taxTotal > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Tax Amount</span>
                    <span className="font-mono text-gray-900">₹{taxTotal.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-200">
                  <span>Grand Total</span>
                  <span className="font-mono text-blue-700 font-extrabold">₹{grandTotal.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Checkout Action Button */}
            <button
              disabled={cart.length === 0 || !selectedCustomer}
              onClick={() => setShowCheckoutConfirm(true)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-2 text-xs"
            >
              <Icons.CreditCard className="w-4 h-4" />
              <span>Proceed to Checkout</span>
            </button>

            {!selectedCustomer && cart.length > 0 && (
              <p className="text-[11px] text-amber-700 font-semibold text-center">
                ⚠️ Please select a customer before proceeding to checkout.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Camera Barcode / QR Scanner Modal */}
      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />

      {/* Create Customer Modal */}
      {showCreateCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 text-xs">
          <div className="bg-white border border-gray-200 rounded-xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Icons.UserPlus className="w-4 h-4 text-blue-600" />
                Create New Customer
              </h3>
              <button
                onClick={() => setShowCreateCustomerModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            {createCustomerError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-lg flex items-center gap-2">
                <Icons.AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createCustomerError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="block font-semibold text-gray-700 mb-1 uppercase">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1 uppercase">Phone Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +91 9876543210"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1 uppercase">Email Address</label>
                <input
                  type="email"
                  placeholder="rahul@example.com"
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1 uppercase">Address</label>
                <input
                  type="text"
                  placeholder="City, State"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateCustomerModal(false)}
                  className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCustomer}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 shadow-sm"
                >
                  {isCreatingCustomer && <Icons.Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save & Select</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checkout Confirmation Modal */}
      {showCheckoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 text-xs">
          <div className="bg-white border border-gray-200 rounded-xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Icons.CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Confirm Retail Sale
              </h3>
              <button
                onClick={() => setShowCheckoutConfirm(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            {checkoutError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-lg flex items-center gap-2">
                <Icons.AlertCircle className="w-4 h-4 shrink-0" />
                <span>{checkoutError}</span>
              </div>
            )}

            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-0.5">
              <span className="text-[10px] text-gray-500 font-semibold uppercase">Customer</span>
              <div className="text-xs font-bold text-gray-900">{selectedCustomer?.name}</div>
              <div className="text-[11px] text-gray-600">{selectedCustomer?.phone}</div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-gray-500 font-semibold uppercase">Sale Items</span>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {cart.map((item, i) => (
                  <div key={i} className="p-2 bg-gray-50 border border-gray-200 rounded flex justify-between text-xs">
                    <div>
                      <span className="font-semibold text-gray-900">{item.productName}</span>
                      {item.imei && <span className="text-[10px] text-emerald-700 font-mono block font-bold">IMEI: {item.imei}</span>}
                    </div>
                    <div className="text-right">
                      <span className="text-gray-500">{item.quantity} x ₹{item.price.toLocaleString()}</span>
                      <div className="font-mono font-bold text-gray-900">₹{(item.quantity * item.price).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <span className="text-xs font-bold text-gray-900">Total Payable Amount</span>
              <span className="text-lg font-extrabold text-blue-700 font-mono">₹{grandTotal.toLocaleString()}</span>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-200">
              <button
                type="button"
                disabled={isSubmittingOrder}
                onClick={() => setShowCheckoutConfirm(false)}
                className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingOrder}
                onClick={handleConfirmSale}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition flex items-center gap-2 shadow-sm"
              >
                {isSubmittingOrder ? (
                  <>
                    <Icons.Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Sale...</span>
                  </>
                ) : (
                  <>
                    <Icons.CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Process Sale</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sale Completed Success Modal */}
      {saleResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 text-xs">
          <div className="bg-white border border-gray-200 rounded-xl w-full max-w-md p-6 shadow-xl space-y-4 text-center">
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <Icons.CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-900">✓ Sale Completed Successfully</h3>
              <p className="text-xs text-gray-500 mt-0.5">Transaction recorded and inventory updated</p>
            </div>

            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5 text-left text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Order Number</span>
                <span className="font-mono font-bold text-blue-700">{saleResult.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Customer</span>
                <span className="font-semibold text-gray-900">{saleResult.customer?.name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Paid</span>
                <span className="font-mono font-extrabold text-emerald-700">
                  ₹{Number(saleResult.totalAmount).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded text-[10px] border border-emerald-200">
                  {saleResult.status}
                </span>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setSaleResult(null)}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition shadow-sm"
              >
                Start Next Sale
              </button>
              <button
                onClick={() => {
                  const id = saleResult.id;
                  setSaleResult(null);
                  navigate(`/sales-orders/${id}`);
                }}
                className="px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-lg transition"
              >
                View Order Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSPage;
