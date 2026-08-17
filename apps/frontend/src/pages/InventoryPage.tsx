import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/api';
import * as Icons from 'lucide-react';
import { CameraScannerModal } from '../components/CameraScannerModal';

interface Product {
  id: string;
  SKU: string;
  name: string;
  brand: string;
  IMEITracked: boolean;
  lowStockThreshold: number;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
  partnerId: string;
}

interface Partner {
  id: string;
  name: string;
  type: string;
}

interface InventoryRecord {
  id: string;
  partnerId: string;
  warehouseId: string;
  productId: string;
  quantity: number;
  reservedQuantity: number;
  status: string;
  product: Product;
  warehouse: Warehouse;
  partner: Partner;
  items?: InventoryItem[];
}

interface InventoryItem {
  id: string;
  IMEI: string;
  serialNumber: string;
  status: string;
  warehouse: Warehouse;
  partner: Partner;
}

interface TransferRequest {
  id: string;
  productId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  sourcePartnerId: string;
  destinationPartnerId: string;
  quantity: number;
  imeis: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  product: Product;
  sourceWarehouse: Warehouse;
  destinationWarehouse: Warehouse;
  sourcePartner: Partner;
  destinationPartner: Partner;
  createdAt: string;
}

interface ReturnRequest {
  id: string;
  productId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  sourcePartnerId: string;
  destinationPartnerId: string;
  quantity: number;
  imeis: string[];
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  product: Product;
  sourceWarehouse: Warehouse;
  destinationWarehouse: Warehouse;
  sourcePartner: Partner;
  destinationPartner: Partner;
  createdAt: string;
}

export const InventoryPage: React.FC = () => {
  const { user, permissions } = useAuth();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'GRN' | 'TRANSFERS' | 'RETURNS'>('OVERVIEW');

  // Master Data
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [inventories, setInventories] = useState<InventoryRecord[]>([]);
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);

  // State & Loading
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters for Overview
  const [filterWarehouseId, setFilterWarehouseId] = useState<string>('');
  const [filterProductId, setFilterProductId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // IMEI Viewing Modal
  const [selectedInventory, setSelectedInventory] = useState<InventoryRecord | null>(null);

  // GRN Form State
  const [grnProductId, setGrnProductId] = useState<string>('');
  const [grnWarehouseId, setGrnWarehouseId] = useState<string>('');
  const [grnQuantity, setGrnQuantity] = useState<number>(1);
  const [grnImeis, setGrnImeis] = useState<string[]>([]);
  const [manualImeiInput, setManualImeiInput] = useState<string>('');
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [grnSubmitting, setGrnSubmitting] = useState<boolean>(false);

  // Transfer Form State
  const [transProductId, setTransProductId] = useState<string>('');
  const [transSourceWarehouseId, setTransSourceWarehouseId] = useState<string>('');
  const [transDestWarehouseId, setTransDestWarehouseId] = useState<string>('');
  const [transQuantity, setTransQuantity] = useState<number>(1);
  const [transSelectedImeis, setTransSelectedImeis] = useState<string[]>([]);
  const [availableSourceItems, setAvailableSourceItems] = useState<InventoryItem[]>([]);
  const [transSubmitting, setTransSubmitting] = useState<boolean>(false);

  // Return Form State
  const [retProductId, setRetProductId] = useState<string>('');
  const [retSourceWarehouseId, setRetSourceWarehouseId] = useState<string>('');
  const [retDestWarehouseId, setRetDestWarehouseId] = useState<string>('');
  const [retQuantity, setRetQuantity] = useState<number>(1);
  const [retReason, setRetReason] = useState<string>('');
  const [retSelectedImeis, setRetSelectedImeis] = useState<string[]>([]);
  const [retSubmitting, setRetSubmitting] = useState<boolean>(false);

  const canCreate = permissions.some((p) => p.resource === 'INVENTORY' && p.action === 'CREATE');
  const canUpdate = permissions.some((p) => p.resource === 'INVENTORY' && p.action === 'UPDATE');

  const fetchMasterData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodsData, whsData] = await Promise.all([
        api.get<Product[]>('/products'),
        api.get<Warehouse[]>('/warehouses'),
      ]);
      setProducts(prodsData);
      setWarehouses(whsData);

      if (whsData.length > 0) {
        if (!grnWarehouseId) setGrnWarehouseId(whsData[0].id);
        if (!transSourceWarehouseId) setTransSourceWarehouseId(whsData[0].id);
        if (!retSourceWarehouseId) setRetSourceWarehouseId(whsData[0].id);
      }
      if (prodsData.length > 0) {
        if (!grnProductId) setGrnProductId(prodsData[0].id);
        if (!transProductId) setTransProductId(prodsData[0].id);
        if (!retProductId) setRetProductId(prodsData[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory master data');
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryData = async () => {
    try {
      const params = new URLSearchParams();
      if (filterWarehouseId) params.append('warehouseId', filterWarehouseId);
      if (filterProductId) params.append('productId', filterProductId);

      const invData = await api.get<InventoryRecord[]>(`/inventory?${params.toString()}`);
      setInventories(invData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch inventory stock');
    }
  };

  const fetchTransferAndReturnData = async () => {
    try {
      const [transfers, returns] = await Promise.all([
        api.get<TransferRequest[]>('/inventory/transfer-requests'),
        api.get<ReturnRequest[]>('/inventory/return-requests'),
      ]);
      setTransferRequests(transfers);
      setReturnRequests(returns);
    } catch (err: any) {
      // Ignore non-critical fetch errors
    }
  };

  useEffect(() => {
    fetchMasterData();
    fetchInventoryData();
    fetchTransferAndReturnData();
  }, [filterWarehouseId, filterProductId]);

  useEffect(() => {
    if (!transProductId || !transSourceWarehouseId) return;

    const selectedProd = products.find((p) => p.id === transProductId);
    if (selectedProd && selectedProd.IMEITracked) {
      api
        .get<InventoryItem[]>(`/inventory/items?productId=${transProductId}&warehouseId=${transSourceWarehouseId}`)
        .then((items) => {
          const avail = items.filter((i) => i.status === 'AVAILABLE');
          setAvailableSourceItems(avail);
        })
        .catch(() => setAvailableSourceItems([]));
    } else {
      setAvailableSourceItems([]);
    }
  }, [transProductId, transSourceWarehouseId, products]);

  const handleAddManualImei = () => {
    const trimmed = manualImeiInput.trim();
    if (!trimmed) return;

    if (grnImeis.includes(trimmed)) {
      setError(`IMEI '${trimmed}' is already in the GRN list`);
      return;
    }

    if (grnImeis.length >= grnQuantity) {
      setError(`Cannot add more than ${grnQuantity} IMEI(s)`);
      return;
    }

    setGrnImeis((prev) => [...prev, trimmed]);
    setManualImeiInput('');
    setError(null);
  };

  const handleScanSuccess = (scannedText: string) => {
    if (!scannedText) return;
    if (grnImeis.includes(scannedText)) {
      setSuccessMsg(`IMEI '${scannedText}' already in list`);
      setTimeout(() => setSuccessMsg(null), 3000);
      return;
    }
    setGrnImeis((prev) => [...prev, scannedText]);
    setSuccessMsg(`Scanned IMEI: ${scannedText}`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleRemoveImei = (index: number) => {
    setGrnImeis((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGrnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGrnSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const selectedProd = products.find((p) => p.id === grnProductId);
      if (selectedProd?.IMEITracked && grnImeis.length !== Number(grnQuantity)) {
        throw new Error(`Product is IMEI tracked. Please scan/enter exactly ${grnQuantity} IMEI(s).`);
      }

      await api.post('/inventory/stock', {
        productId: grnProductId,
        warehouseId: grnWarehouseId,
        quantity: Number(grnQuantity),
        imeis: selectedProd?.IMEITracked ? grnImeis : undefined,
      });

      setSuccessMsg('✓ Goods Received Note (GRN) submitted successfully!');
      setGrnImeis([]);
      setManualImeiInput('');
      await fetchInventoryData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'GRN submission failed');
    } finally {
      setGrnSubmitting(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const selectedProd = products.find((p) => p.id === transProductId);
      if (selectedProd?.IMEITracked && transSelectedImeis.length !== Number(transQuantity)) {
        throw new Error(`Please select exactly ${transQuantity} IMEI(s) to transfer.`);
      }

      await api.post('/inventory/transfer-requests', {
        productId: transProductId,
        sourceWarehouseId: transSourceWarehouseId,
        destinationWarehouseId: transDestWarehouseId,
        quantity: Number(transQuantity),
        imeis: selectedProd?.IMEITracked ? transSelectedImeis : undefined,
      });

      setSuccessMsg('✓ Stock transfer request created! Pending receiving partner approval.');
      setTransSelectedImeis([]);
      await fetchTransferAndReturnData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Stock transfer request failed');
    } finally {
      setTransSubmitting(false);
    }
  };

  const handleApproveTransfer = async (id: string) => {
    setError(null);
    try {
      await api.patch(`/inventory/transfer-requests/${id}/approve`, {});
      setSuccessMsg('✓ Transfer request approved! Stock moved successfully.');
      await fetchInventoryData();
      await fetchTransferAndReturnData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to approve transfer');
    }
  };

  const handleRejectTransfer = async (id: string) => {
    if (!window.confirm('Are you sure you want to reject this incoming transfer request?')) return;
    setError(null);
    try {
      await api.patch(`/inventory/transfer-requests/${id}/reject`, {});
      setSuccessMsg('✓ Transfer request rejected.');
      await fetchTransferAndReturnData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to reject transfer');
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRetSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const selectedProd = products.find((p) => p.id === retProductId);
      if (selectedProd?.IMEITracked && retSelectedImeis.length !== Number(retQuantity)) {
        throw new Error(`Please select exactly ${retQuantity} IMEI(s) to return.`);
      }

      await api.post('/inventory/return-requests', {
        productId: retProductId,
        sourceWarehouseId: retSourceWarehouseId,
        destinationWarehouseId: retDestWarehouseId,
        quantity: Number(retQuantity),
        imeis: selectedProd?.IMEITracked ? retSelectedImeis : undefined,
        reason: retReason || undefined,
      });

      setSuccessMsg('✓ Stock return request submitted! Pending receiving parent partner approval.');
      setRetSelectedImeis([]);
      setRetReason('');
      await fetchTransferAndReturnData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Stock return request failed');
    } finally {
      setRetSubmitting(false);
    }
  };

  const handleApproveReturn = async (id: string) => {
    setError(null);
    try {
      await api.patch(`/inventory/return-requests/${id}/approve`, {});
      setSuccessMsg('✓ Return request approved! Stock returned successfully.');
      await fetchInventoryData();
      await fetchTransferAndReturnData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to approve return');
    }
  };

  const handleRejectReturn = async (id: string) => {
    if (!window.confirm('Are you sure you want to reject this stock return request?')) return;
    setError(null);
    try {
      await api.patch(`/inventory/return-requests/${id}/reject`, {});
      setSuccessMsg('✓ Return request rejected.');
      await fetchTransferAndReturnData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to reject return');
    }
  };

  const filteredInventories = inventories.filter((inv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.product.name.toLowerCase().includes(q) ||
      inv.product.SKU.toLowerCase().includes(q) ||
      inv.warehouse.name.toLowerCase().includes(q) ||
      inv.partner.name.toLowerCase().includes(q)
    );
  });

  const selectedGrnProd = products.find((p) => p.id === grnProductId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
            <Icons.Warehouse className="w-6 h-6 text-blue-600" />
            Inventory & Stock Operations
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            Real-time IMEI tracking, Goods Received Notes (GRN), and Stock Transfer & Return approvals
          </p>
        </div>

        <button
          onClick={() => {
            fetchInventoryData();
            fetchTransferAndReturnData();
          }}
          className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-300 transition flex items-center gap-2 text-xs font-medium self-start sm:self-auto"
        >
          <Icons.RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icons.AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <Icons.X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icons.CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            <Icons.X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex items-center space-x-2 border-b border-gray-200 pb-3">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2 rounded-lg font-bold text-xs transition flex items-center gap-2 ${
            activeTab === 'OVERVIEW'
              ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Icons.Boxes className="w-4 h-4" />
          Stock Overview
        </button>

        {canCreate && (
          <button
            onClick={() => setActiveTab('GRN')}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition flex items-center gap-2 ${
              activeTab === 'GRN'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Icons.QrCode className="w-4 h-4" />
            Goods Received (GRN)
          </button>
        )}

        {canUpdate && (
          <button
            onClick={() => setActiveTab('TRANSFERS')}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition flex items-center gap-2 ${
              activeTab === 'TRANSFERS'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Icons.ArrowRightLeft className="w-4 h-4" />
            Stock Transfers
            {transferRequests.filter((t) => t.status === 'PENDING').length > 0 && (
              <span className="px-2 py-0.5 text-[10px] bg-amber-100 text-amber-800 rounded-full font-bold">
                {transferRequests.filter((t) => t.status === 'PENDING').length}
              </span>
            )}
          </button>
        )}

        {canUpdate && (
          <button
            onClick={() => setActiveTab('RETURNS')}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition flex items-center gap-2 ${
              activeTab === 'RETURNS'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Icons.RotateCcw className="w-4 h-4" />
            Stock Returns
            {returnRequests.filter((r) => r.status === 'PENDING').length > 0 && (
              <span className="px-2 py-0.5 text-[10px] bg-purple-100 text-purple-800 rounded-full font-bold">
                {returnRequests.filter((r) => r.status === 'PENDING').length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* TAB 1: STOCK OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-5">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase">Search Product / SKU</label>
              <div className="relative">
                <Icons.Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Apex X200..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase">Filter by Warehouse</label>
              <select
                value={filterWarehouseId}
                onChange={(e) => setFilterWarehouseId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600"
              >
                <option value="">All Permitted Warehouses</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name} ({wh.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase">Filter by Product</label>
              <select
                value={filterProductId}
                onChange={(e) => setFilterProductId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600"
              >
                <option value="">All Products</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.SKU})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stock Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider">
                    <th className="p-3.5">Product Name</th>
                    <th className="p-3.5">SKU</th>
                    <th className="p-3.5">Warehouse</th>
                    <th className="p-3.5">Partner Org</th>
                    <th className="p-3.5 text-center">Available Qty</th>
                    <th className="p-3.5 text-center">IMEI Tracked</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800">
                  {filteredInventories.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400">
                        No inventory stock records found matching filters
                      </td>
                    </tr>
                  ) : (
                    filteredInventories.map((inv) => {
                      const isLowStock = inv.quantity < inv.product.lowStockThreshold;

                      return (
                        <tr key={inv.id} className="hover:bg-gray-50/70 transition">
                          <td className="p-3.5 font-bold text-gray-900 flex items-center gap-2">
                            <Icons.Package className="w-4 h-4 text-blue-600 shrink-0" />
                            {inv.product.name}
                          </td>
                          <td className="p-3.5 font-mono text-gray-600">{inv.product.SKU}</td>
                          <td className="p-3.5 text-gray-700">{inv.warehouse.name}</td>
                          <td className="p-3.5 text-gray-600">{inv.partner.name}</td>
                          <td className="p-3.5 text-center font-bold text-gray-900">
                            {inv.quantity}
                          </td>
                          <td className="p-3.5 text-center">
                            {inv.product.IMEITracked ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-700 border border-blue-200">
                                IMEI Tracked
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600 border border-gray-200">
                                Batch Product
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            {isLowStock ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                                <Icons.AlertTriangle className="w-3 h-3" />
                                LOW STOCK ({inv.quantity}/{inv.product.lowStockThreshold})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                IN_STOCK
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            {inv.product.IMEITracked && (
                              <button
                                onClick={() => setSelectedInventory(inv)}
                                className="px-2.5 py-1 bg-white hover:bg-gray-50 text-blue-600 border border-gray-300 font-semibold text-xs rounded-md transition inline-flex items-center gap-1 shadow-sm"
                              >
                                <Icons.Eye className="w-3.5 h-3.5" />
                                View IMEIs ({inv.items?.length || 0})
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GOODS RECEIVED NOTE (GRN) */}
      {activeTab === 'GRN' && (
        <div className="max-w-xl mx-auto bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5 text-xs">
          <div className="border-b border-gray-200 pb-3">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Icons.QrCode className="w-5 h-5 text-blue-600" />
              Goods Received Note (GRN) — Add Stock
            </h3>
            <p className="text-gray-500 text-xs mt-0.5">
              Add new inventory stock into your warehouse using barcode scanner or manual input
            </p>
          </div>

          <form onSubmit={handleGrnSubmit} className="space-y-4">
            <div>
              <label className="block font-semibold text-gray-700 mb-1 uppercase">Select Product *</label>
              <select
                required
                value={grnProductId}
                onChange={(e) => {
                  setGrnProductId(e.target.value);
                  setGrnImeis([]);
                }}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.SKU}) — {p.IMEITracked ? 'IMEI Tracked' : 'Non-IMEI'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1 uppercase">Target Warehouse *</label>
              <select
                required
                value={grnWarehouseId}
                onChange={(e) => setGrnWarehouseId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600"
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name} ({wh.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1 uppercase">Quantity *</label>
              <input
                type="number"
                min="1"
                required
                value={grnQuantity}
                onChange={(e) => setGrnQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600"
              />
            </div>

            {selectedGrnProd?.IMEITracked && (
              <div className="space-y-3 pt-2 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-gray-800 uppercase">
                    Physical IMEIs ({grnImeis.length} / {grnQuantity}) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Icons.Camera className="w-3.5 h-3.5" />
                    Scan Barcode / QR
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualImeiInput}
                    onChange={(e) => setManualImeiInput(e.target.value)}
                    placeholder="Enter IMEI manually..."
                    className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={handleAddManualImei}
                    className="px-3.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg shadow-sm"
                  >
                    + Add
                  </button>
                </div>

                {/* Scanned/Entered IMEI List */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-40 overflow-y-auto space-y-1">
                  {grnImeis.length === 0 ? (
                    <div className="text-xs text-gray-400 text-center py-4">
                      No IMEIs added yet. Use manual entry or camera scanner.
                    </div>
                  ) : (
                    grnImeis.map((imei, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-white px-3 py-1.5 rounded border border-gray-200 text-xs text-gray-900"
                      >
                        <span className="font-mono">{imei}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveImei(idx)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <Icons.X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={grnSubmitting}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition shadow-sm flex items-center justify-center gap-2 mt-2"
            >
              {grnSubmitting ? (
                <Icons.RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Icons.CheckCircle2 className="w-4 h-4" />
              )}
              <span>Submit GRN / Add Stock</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: STOCK TRANSFERS & APPROVALS */}
      {activeTab === 'TRANSFERS' && (
        <div className="space-y-6">
          {/* Create Transfer Request */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Icons.ArrowRightLeft className="w-4 h-4 text-blue-600" />
              Initiate Stock Transfer Request
            </h3>

            <form onSubmit={handleTransferSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-gray-700 mb-1 uppercase">Source Warehouse *</label>
                <select
                  required
                  value={transSourceWarehouseId}
                  onChange={(e) => setTransSourceWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1 uppercase">Destination Warehouse *</label>
                <select
                  required
                  value={transDestWarehouseId}
                  onChange={(e) => setTransDestWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600"
                >
                  <option value="" disabled>Select Destination</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1 uppercase">Product *</label>
                <select
                  required
                  value={transProductId}
                  onChange={(e) => setTransProductId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1 uppercase">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transQuantity}
                  onChange={(e) => setTransQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600"
                />
              </div>

              {availableSourceItems.length > 0 && (
                <div className="col-span-full bg-gray-50 p-3.5 rounded-lg border border-gray-200 space-y-2">
                  <label className="block font-semibold text-gray-800">
                    Select IMEIs to Transfer ({transSelectedImeis.length} / {transQuantity})
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto">
                    {availableSourceItems.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-xs text-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={transSelectedImeis.includes(item.IMEI)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTransSelectedImeis((prev) => [...prev, item.IMEI]);
                            } else {
                              setTransSelectedImeis((prev) => prev.filter((i) => i !== item.IMEI));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-0"
                        />
                        <span className="font-mono">{item.IMEI}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="col-span-full flex justify-end">
                <button
                  type="submit"
                  disabled={transSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-sm"
                >
                  {transSubmitting ? 'Creating Request...' : 'Submit Transfer Request'}
                </button>
              </div>
            </form>
          </div>

          {/* Transfer Requests Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-3.5 border-b border-gray-200 font-bold text-gray-900 text-sm">
              Transfer Requests & Approvals
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider">
                    <th className="p-3.5">From Partner</th>
                    <th className="p-3.5">To Partner</th>
                    <th className="p-3.5">Product</th>
                    <th className="p-3.5 text-center">Qty</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800">
                  {transferRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400">
                        No transfer requests found
                      </td>
                    </tr>
                  ) : (
                    transferRequests.map((reqItem) => {
                      const isReceivingPartner =
                        user?.role === 'ADMIN' || (user?.partnerId && user.partnerId === reqItem.destinationPartnerId);

                      return (
                        <tr key={reqItem.id} className="hover:bg-gray-50/70 transition">
                          <td className="p-3.5 font-semibold text-gray-900">{reqItem.sourcePartner.name}</td>
                          <td className="p-3.5 font-semibold text-gray-900">{reqItem.destinationPartner.name}</td>
                          <td className="p-3.5 text-gray-800">{reqItem.product.name}</td>
                          <td className="p-3.5 text-center font-bold text-gray-900">{reqItem.quantity}</td>
                          <td className="p-3.5 text-center">
                            {reqItem.status === 'APPROVED' && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                APPROVED
                              </span>
                            )}
                            {reqItem.status === 'PENDING' && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-50 text-amber-700 border border-amber-200">
                                PENDING
                              </span>
                            )}
                            {reqItem.status === 'REJECTED' && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-50 text-rose-700 border border-rose-200">
                                REJECTED
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            {reqItem.status === 'PENDING' && isReceivingPartner ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleApproveTransfer(reqItem.id)}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-md shadow-sm"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectTransfer(reqItem.id)}
                                  className="px-3 py-1 bg-white border border-rose-300 hover:bg-rose-50 text-rose-600 font-semibold text-xs rounded-md"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">
                                {reqItem.status !== 'PENDING' ? 'Processed' : 'Awaiting Receiver'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STOCK RETURNS & APPROVALS */}
      {activeTab === 'RETURNS' && (
        <div className="space-y-6">
          {/* Create Return Request */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Icons.RotateCcw className="w-4 h-4 text-purple-600" />
              Initiate Stock Return Request (To Parent Partner)
            </h3>

            <form onSubmit={handleReturnSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-gray-700 mb-1 uppercase">Source Warehouse *</label>
                <select
                  required
                  value={retSourceWarehouseId}
                  onChange={(e) => setRetSourceWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1 uppercase">Destination Warehouse *</label>
                <select
                  required
                  value={retDestWarehouseId}
                  onChange={(e) => setRetDestWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600"
                >
                  <option value="" disabled>Select Destination</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1 uppercase">Product *</label>
                <select
                  required
                  value={retProductId}
                  onChange={(e) => setRetProductId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1 uppercase">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={retQuantity}
                  onChange={(e) => setRetQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="col-span-full">
                <label className="block font-semibold text-gray-700 mb-1 uppercase">Reason for Return</label>
                <input
                  type="text"
                  value={retReason}
                  onChange={(e) => setRetReason(e.target.value)}
                  placeholder="e.g. Overstock / Stock rotation..."
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="col-span-full flex justify-end">
                <button
                  type="submit"
                  disabled={retSubmitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg text-xs shadow-sm"
                >
                  {retSubmitting ? 'Submitting...' : 'Submit Return Request'}
                </button>
              </div>
            </form>
          </div>

          {/* Return Requests Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-3.5 border-b border-gray-200 font-bold text-gray-900 text-sm">
              Return Requests & Approvals
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider">
                    <th className="p-3.5">From Partner</th>
                    <th className="p-3.5">To Parent Partner</th>
                    <th className="p-3.5">Product</th>
                    <th className="p-3.5 text-center">Qty</th>
                    <th className="p-3.5">Reason</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800">
                  {returnRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400">
                        No return requests found
                      </td>
                    </tr>
                  ) : (
                    returnRequests.map((reqItem) => {
                      const isReceivingPartner =
                        user?.role === 'ADMIN' || (user?.partnerId && user.partnerId === reqItem.destinationPartnerId);

                      return (
                        <tr key={reqItem.id} className="hover:bg-gray-50/70 transition">
                          <td className="p-3.5 font-semibold text-gray-900">{reqItem.sourcePartner.name}</td>
                          <td className="p-3.5 font-semibold text-gray-900">{reqItem.destinationPartner.name}</td>
                          <td className="p-3.5 text-gray-800">{reqItem.product.name}</td>
                          <td className="p-3.5 text-center font-bold text-gray-900">{reqItem.quantity}</td>
                          <td className="p-3.5 text-gray-500 text-xs">{reqItem.reason || 'N/A'}</td>
                          <td className="p-3.5 text-center">
                            {reqItem.status === 'APPROVED' && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                APPROVED
                              </span>
                            )}
                            {reqItem.status === 'PENDING' && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-50 text-amber-700 border border-amber-200">
                                PENDING
                              </span>
                            )}
                            {reqItem.status === 'REJECTED' && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-50 text-rose-700 border border-rose-200">
                                REJECTED
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            {reqItem.status === 'PENDING' && isReceivingPartner ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleApproveReturn(reqItem.id)}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-md shadow-sm"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectReturn(reqItem.id)}
                                  className="px-3 py-1 bg-white border border-rose-300 hover:bg-rose-50 text-rose-600 font-semibold text-xs rounded-md"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">
                                {reqItem.status !== 'PENDING' ? 'Processed' : 'Awaiting Receiver'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Drawer / Modal to view IMEIs for an Inventory Record */}
      {selectedInventory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-xl w-full max-w-lg p-6 shadow-xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Icons.QrCode className="w-5 h-5 text-blue-600" />
                Physical IMEIs for {selectedInventory.product.name}
              </h3>
              <button onClick={() => setSelectedInventory(null)} className="text-gray-400 hover:text-gray-600">
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-gray-600 flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
              <span>Warehouse: <strong>{selectedInventory.warehouse.name}</strong></span>
              <span>Total IMEIs: <strong>{selectedInventory.items?.length || 0}</strong></span>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-60 overflow-y-auto space-y-1.5">
              {(!selectedInventory.items || selectedInventory.items.length === 0) ? (
                <div className="text-center py-6 text-xs text-gray-400">
                  No individual physical items found for this record.
                </div>
              ) : (
                selectedInventory.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-white p-2.5 rounded border border-gray-200 text-xs"
                  >
                    <span className="font-mono text-gray-900 font-bold">{item.IMEI}</span>
                    <span className="px-2 py-0.5 rounded font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                      {item.status}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-200">
              <button
                onClick={() => setSelectedInventory(null)}
                className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
};

export default InventoryPage;
