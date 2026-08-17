import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/api';
import { purchaseOrdersService } from '../services/purchase-orders.service';
import * as Icons from 'lucide-react';

interface PartnerOption {
  id: string;
  name: string;
  type: 'SUPPLIER' | 'DISTRIBUTOR' | 'DEALER' | 'DIRECT_DEALER';
  parentPartnerId: string | null;
  territory: string | null;
}

interface ProductOption {
  id: string;
  SKU: string;
  name: string;
  brand: string;
  MRP: number | string;
  supplierPrice?: number | string;
  distributorPrice?: number | string;
  dealerPrice?: number | string;
  directDealerPrice?: number | string;
  minimumOrderQuantity?: number;
  IMEITracked: boolean;
  status: string;
}

interface LineItem {
  productId: string;
  product: ProductOption;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export const CreatePurchaseOrderPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sellers, setSellers] = useState<PartnerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingInit, setLoadingInit] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected Seller
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');
  const selectedSeller = sellers.find((s) => s.id === selectedSellerId);

  // Line Picker State
  const [productSearch, setProductSearch] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantityInput, setQuantityInput] = useState<number>(1);

  // Lines State
  const [lines, setLines] = useState<LineItem[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showConfirmPlaceModal, setShowConfirmPlaceModal] = useState<boolean>(false);

  // Load Sellers & Products
  useEffect(() => {
    const loadData = async () => {
      setLoadingInit(true);
      setError(null);
      try {
        const [allPartners, allProducts] = await Promise.all([
          api.get<PartnerOption[]>('/partners'),
          api.get<ProductOption[]>('/products'),
        ]);

        const buyerType = user?.partnerDetails?.type || user?.role;

        let validSellers: PartnerOption[] = [];
        if (buyerType === 'DISTRIBUTOR' || buyerType === 'DIRECT_DEALER') {
          validSellers = allPartners.filter((p) => p.type === 'SUPPLIER');
        } else if (buyerType === 'DEALER') {
          if (user?.partnerDetails) {
            const mePartner = allPartners.find((p) => p.id === user.partnerId);
            if (mePartner?.parentPartnerId) {
              validSellers = allPartners.filter((p) => p.id === mePartner.parentPartnerId);
            } else {
              validSellers = allPartners.filter((p) => p.type === 'DISTRIBUTOR');
            }
          } else {
            validSellers = allPartners.filter((p) => p.type === 'DISTRIBUTOR');
          }
        } else {
          validSellers = allPartners.filter((p) => p.type === 'SUPPLIER' || p.type === 'DISTRIBUTOR');
        }

        setSellers(validSellers);
        if (validSellers.length > 0) {
          setSelectedSellerId(validSellers[0].id);
        }

        const activeProds = allProducts.filter((p) => p.status === 'ACTIVE');
        setProducts(activeProds);
        if (activeProds.length > 0) {
          setSelectedProductId(activeProds[0].id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to initialize Purchase Order creation form');
      } finally {
        setLoadingInit(false);
      }
    };

    loadData();
  }, [user]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const filteredProductOptions = products.filter((p) => {
    const q = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.SKU.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);
  });

  const calculateTierPrice = (prod?: ProductOption, seller?: PartnerOption): number => {
    if (!prod || !seller) return 0;
    const buyerType = user?.partnerDetails?.type || user?.role;

    if (seller.type === 'SUPPLIER' && buyerType === 'DISTRIBUTOR') {
      return Number(prod.distributorPrice) || Number(prod.MRP);
    }
    if (seller.type === 'SUPPLIER' && buyerType === 'DIRECT_DEALER') {
      return Number(prod.directDealerPrice) || Number(prod.MRP);
    }
    if (seller.type === 'DISTRIBUTOR' && buyerType === 'DEALER') {
      return Number(prod.dealerPrice) || Number(prod.MRP);
    }
    return Number(prod.distributorPrice) || Number(prod.MRP);
  };

  const currentUnitPrice = calculateTierPrice(selectedProduct, selectedSeller);
  const currentLineTotal = currentUnitPrice * quantityInput;
  const currentMOQ = selectedProduct?.minimumOrderQuantity || 1;

  const handleAddLine = () => {
    if (!selectedProduct) return;
    if (quantityInput <= 0) {
      setError('Quantity must be greater than zero');
      return;
    }

    const existingIndex = lines.findIndex((l) => l.productId === selectedProduct.id);
    if (existingIndex >= 0) {
      const updated = [...lines];
      const newQty = updated[existingIndex].quantity + quantityInput;
      updated[existingIndex].quantity = newQty;
      updated[existingIndex].lineTotal = newQty * updated[existingIndex].unitPrice;
      setLines(updated);
    } else {
      setLines([
        ...lines,
        {
          productId: selectedProduct.id,
          product: selectedProduct,
          quantity: quantityInput,
          unitPrice: currentUnitPrice,
          lineTotal: currentLineTotal,
        },
      ]);
    }

    setError(null);
  };

  const handleRemoveLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const grandTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(num);
  };

  const handleSaveDraft = async () => {
    if (!selectedSellerId) {
      setError('Please select a seller partner');
      return;
    }
    if (lines.length === 0) {
      setError('Please add at least one product line item to the order');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const createdPO = await purchaseOrdersService.create({
        sellerPartnerId: selectedSellerId,
        lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      });

      navigate(`/purchase-orders/${createdPO.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to save draft purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPlacePO = async () => {
    if (!selectedSellerId || lines.length === 0) return;

    setSubmitting(true);
    setError(null);
    try {
      const createdPO = await purchaseOrdersService.create({
        sellerPartnerId: selectedSellerId,
        lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      });

      const placedPO = await purchaseOrdersService.place(createdPO.id);
      setShowConfirmPlaceModal(false);
      navigate(`/purchase-orders/${placedPO.id}`);
    } catch (err: any) {
      setShowConfirmPlaceModal(false);
      setError(err.message || 'Failed to place purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInit) {
    return (
      <div className="p-12 text-center text-gray-500 text-xs space-y-2">
        <Icons.Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
        <p>Loading partner & catalog information...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/purchase-orders" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-1 font-semibold">
            <Icons.ArrowLeft className="w-3.5 h-3.5" /> Back to Purchase Orders
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Create Purchase Order</h1>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700 text-xs font-medium">
          <Icons.AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <Icons.X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP 1: Seller Partner Selection */}
      <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4 text-xs">
        <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
          <Icons.Building2 className="w-4 h-4 text-blue-600" />
          1. Select Seller Partner
        </h2>

        {sellers.length === 0 ? (
          <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
            No eligible seller partners found in your partner hierarchy.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-gray-700 mb-1 uppercase">Seller Partner *</label>
              <select
                value={selectedSellerId}
                onChange={(e) => setSelectedSellerId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-blue-600"
              >
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.type})
                  </option>
                ))}
              </select>
            </div>

            {selectedSeller && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1 text-gray-600">
                <p className="text-gray-900 font-bold">{selectedSeller.name}</p>
                <p>Type: <span className="text-blue-700 font-mono font-bold">{selectedSeller.type}</span></p>
                <p>Territory: {selectedSeller.territory || 'National'}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* STEP 2: Product Picker & Line Adder */}
      <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4 text-xs">
        <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
          <Icons.PackagePlus className="w-4 h-4 text-blue-600" />
          2. Add Products
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <label className="block font-semibold text-gray-700 uppercase">Search Catalog Product</label>
            <div className="relative">
              <Icons.Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter by product name, SKU, brand..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-blue-600"
              />
            </div>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-blue-600"
            >
              {filteredProductOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.SKU}) — MOQ: {p.minimumOrderQuantity || 1}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1 uppercase">
                Order Quantity (MOQ: {currentMOQ})
              </label>
              <input
                type="number"
                min={1}
                value={quantityInput}
                onChange={(e) => setQuantityInput(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-blue-600 font-mono"
              />
              {quantityInput < currentMOQ && (
                <p className="text-[11px] text-amber-700 font-semibold mt-1">
                  ⚠️ Below minimum order quantity ({currentMOQ}).
                </p>
              )}
            </div>

            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center text-xs">
              <span className="text-gray-600 font-medium">Tier Price:</span>
              <span className="font-mono font-bold text-blue-700 text-sm">
                {formatCurrency(currentUnitPrice)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleAddLine}
            disabled={!selectedProduct}
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-blue-700 font-semibold text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm"
          >
            <Icons.Plus className="w-4 h-4" />
            Add Line Item
          </button>
        </div>
      </div>

      {/* STEP 3: Order Items Table & Summary */}
      <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4 text-xs">
        <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
          <Icons.ListOrdered className="w-4 h-4 text-blue-600" />
          3. Purchase Order Items Summary
        </h2>

        {lines.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-gray-200 rounded-lg text-gray-400 text-xs">
            No items added to this purchase order yet. Select a product above and click "Add Line Item".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-4">Product</th>
                  <th className="py-2.5 px-4">SKU</th>
                  <th className="py-2.5 px-4 text-right">Quantity</th>
                  <th className="py-2.5 px-4 text-right">Unit Price</th>
                  <th className="py-2.5 px-4 text-right">Line Total</th>
                  <th className="py-2.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {lines.map((item, idx) => (
                  <tr key={item.productId} className="hover:bg-gray-50/70 transition">
                    <td className="py-3 px-4 font-bold text-gray-900">{item.product.name}</td>
                    <td className="py-3 px-4 font-mono text-gray-500">{item.product.SKU}</td>
                    <td className="py-3 px-4 text-right font-mono text-gray-900 font-bold">{item.quantity}</td>
                    <td className="py-3 px-4 text-right font-mono text-gray-700">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">
                      {formatCurrency(item.lineTotal)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleRemoveLine(idx)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded transition"
                        title="Remove item"
                      >
                        <Icons.Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {lines.length > 0 && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center">
            <span className="text-xs font-bold text-gray-800">Total Purchase Order Amount:</span>
            <span className="text-base font-extrabold font-mono text-blue-700">{formatCurrency(grandTotal)}</span>
          </div>
        )}

        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={submitting || lines.length === 0}
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold"
          >
            Save as Draft
          </button>

          <button
            type="button"
            onClick={() => setShowConfirmPlaceModal(true)}
            disabled={submitting || lines.length === 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-2"
          >
            <Icons.Send className="w-4 h-4" />
            <span>Place Purchase Order</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmPlaceModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
            <div className="flex items-center space-x-2 text-blue-600">
              <Icons.HelpCircle className="w-5 h-5" />
              <h3 className="text-base font-bold text-gray-900">Confirm Order Placement</h3>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Are you sure you want to officially place this Purchase Order with{' '}
              <strong className="text-gray-900">{selectedSeller?.name}</strong> for{' '}
              <strong className="text-blue-700">{formatCurrency(grandTotal)}</strong> ({lines.length} line items)?
            </p>
            <div className="flex justify-end space-x-2.5 pt-3 border-t border-gray-200">
              <button
                onClick={() => setShowConfirmPlaceModal(false)}
                className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPlacePO}
                disabled={submitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 shadow-sm"
              >
                {submitting && <Icons.Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm & Place</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatePurchaseOrderPage;
