import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { purchaseOrdersService } from '../services/purchase-orders.service';
import { PurchaseOrder } from '../types/purchase-order';
import { PurchaseOrderStatusPipeline } from '../components/orders/PurchaseOrderStatusPipeline';
import * as Icons from 'lucide-react';

export const PurchaseOrderDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, permissions } = useAuth();

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Modals
  const [confirmAction, setConfirmAction] = useState<'place' | 'approve' | 'reject' | 'dispatch' | 'deliver' | null>(null);

  const canUpdate = permissions.some((p) => p.resource === 'ORDER' && p.action === 'UPDATE');

  const fetchPO = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await purchaseOrdersService.getById(id);
      setPo(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase order details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPO();
  }, [id]);

  const formatCurrency = (val: number | string) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(num);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const handleExecuteAction = async () => {
    if (!po || !confirmAction) return;
    setActionLoading(true);
    setError(null);
    try {
      if (confirmAction === 'place') {
        await purchaseOrdersService.place(po.id);
      } else if (confirmAction === 'approve') {
        await purchaseOrdersService.approve(po.id);
      } else if (confirmAction === 'reject') {
        await purchaseOrdersService.reject(po.id);
      } else if (confirmAction === 'dispatch') {
        await purchaseOrdersService.dispatch(po.id);
      } else if (confirmAction === 'deliver') {
        await purchaseOrdersService.deliver(po.id);
      }
      setConfirmAction(null);
      await fetchPO();
    } catch (err: any) {
      setError(err.message || `Failed to execute ${confirmAction} action`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 text-xs space-y-2">
        <Icons.Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
        <p>Loading purchase order details...</p>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 text-xs">
        <Link to="/purchase-orders" className="text-blue-600 hover:underline flex items-center gap-1 font-semibold">
          <Icons.ArrowLeft className="w-3.5 h-3.5" /> Back to Purchase Orders
        </Link>
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center space-y-2">
          <Icons.AlertTriangle className="w-6 h-6 text-red-600 mx-auto" />
          <h2 className="text-sm font-bold text-red-900">Error Loading Purchase Order</h2>
          <p className="text-red-700">{error || 'Purchase Order not found'}</p>
        </div>
      </div>
    );
  }

  const isBuyerUser = user?.role === 'ADMIN' || (user?.partnerId && user.partnerId === po.buyerPartnerId);
  const isSellerUser = user?.role === 'ADMIN' || (user?.partnerId && user.partnerId === po.sellerPartnerId);

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-xs">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <Link to="/purchase-orders" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-1 font-semibold">
            <Icons.ArrowLeft className="w-3.5 h-3.5" /> Back to Purchase Orders
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-mono text-gray-900">{po.orderNumber}</h1>
            <span className="px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold rounded uppercase">
              {po.status}
            </span>
          </div>
        </div>

        {/* Action Controls Header */}
        <div className="flex items-center gap-2.5">
          {po.status === 'DRAFT' && isBuyerUser && (
            <button
              onClick={() => setConfirmAction('place')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 shadow-sm"
            >
              <Icons.Send className="w-4 h-4" />
              <span>Place Order</span>
            </button>
          )}

          {(po.status === 'PLACED' || po.status === 'SUBMITTED') && isSellerUser && canUpdate && (
            <>
              <button
                onClick={() => setConfirmAction('reject')}
                className="px-3.5 py-2 bg-white border border-red-300 hover:bg-red-50 text-red-600 rounded-lg font-semibold flex items-center gap-1.5"
              >
                <Icons.XCircle className="w-4 h-4" />
                <span>Reject</span>
              </button>
              <button
                onClick={() => setConfirmAction('approve')}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Icons.CheckCircle2 className="w-4 h-4" />
                <span>Approve & Allocate Stock</span>
              </button>
            </>
          )}

          {po.status === 'APPROVED' && isSellerUser && canUpdate && (
            <button
              onClick={() => setConfirmAction('dispatch')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <Icons.Truck className="w-4 h-4" />
              <span>Dispatch Order</span>
            </button>
          )}

          {po.status === 'DISPATCHED' && isBuyerUser && (
            <button
              onClick={() => setConfirmAction('deliver')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <Icons.PackageCheck className="w-4 h-4" />
              <span>Mark as Delivered</span>
            </button>
          )}
        </div>
      </div>

      {/* Visual Status Tracker Pipeline */}
      <PurchaseOrderStatusPipeline status={po.status} />

      {/* Order Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Buyer Info */}
        <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-1.5">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Buyer Partner</span>
          <p className="text-base font-bold text-gray-900">{po.buyerPartner?.name}</p>
          <p className="text-xs text-blue-700 font-mono font-semibold">Type: {po.buyerPartner?.type}</p>
          {po.destinationWarehouse && (
            <p className="text-xs text-gray-500 pt-1">
              Destination WH: <span className="text-gray-800 font-mono font-semibold">{po.destinationWarehouse.name} ({po.destinationWarehouse.code})</span>
            </p>
          )}
        </div>

        {/* Seller Info */}
        <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-1.5">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Seller Partner</span>
          <p className="text-base font-bold text-gray-900">{po.sellerPartner?.name}</p>
          <p className="text-xs text-blue-700 font-mono font-semibold">Type: {po.sellerPartner?.type}</p>
          {po.sourceWarehouse && (
            <p className="text-xs text-gray-500 pt-1">
              Source WH: <span className="text-gray-800 font-mono font-semibold">{po.sourceWarehouse.name} ({po.sourceWarehouse.code})</span>
            </p>
          )}
        </div>

        {/* Financial Info */}
        <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-1.5">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Total Amount</span>
          <p className="text-xl font-extrabold font-mono text-blue-700">{formatCurrency(po.totalAmount)}</p>
          <p className="text-xs text-gray-500">Created: {formatDate(po.createdAt)}</p>
          {po.approvedAt && (
            <p className="text-xs text-emerald-700 font-semibold">Approved: {formatDate(po.approvedAt)}</p>
          )}
        </div>
      </div>

      {/* PO Line Items Table */}
      <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
          <Icons.ListOrdered className="w-4 h-4 text-blue-600" />
          Product Line Items ({po.lines?.length || 0})
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-4">Product Name</th>
                <th className="py-2.5 px-4">SKU</th>
                <th className="py-2.5 px-4 text-right">Quantity</th>
                <th className="py-2.5 px-4 text-right">Unit Price</th>
                <th className="py-2.5 px-4 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {po.lines?.map((line) => (
                <tr key={line.id} className="hover:bg-gray-50/70 transition">
                  <td className="py-3 px-4 font-bold text-gray-900">{line.product?.name}</td>
                  <td className="py-3 px-4 font-mono text-gray-500">{line.product?.SKU}</td>
                  <td className="py-3 px-4 text-right font-mono text-gray-900 font-bold">{line.quantity}</td>
                  <td className="py-3 px-4 text-right font-mono text-gray-700">
                    {formatCurrency(line.unitPrice)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">
                    {formatCurrency(line.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
            <div className="flex items-center space-x-2 text-blue-600">
              <Icons.HelpCircle className="w-5 h-5" />
              <h3 className="text-base font-bold text-gray-900 uppercase">
                Confirm {confirmAction}
              </h3>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Are you sure you want to perform <strong className="text-gray-900 uppercase">{confirmAction}</strong> on Purchase Order{' '}
              <strong className="text-blue-700 font-mono">{po.orderNumber}</strong>?
            </p>

            {confirmAction === 'approve' && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-800 space-y-1">
                <p className="font-bold">⚠️ Stock Allocation Trigger</p>
                <p>Approving will allocate stock and transfer inventory from seller to buyer warehouse.</p>
              </div>
            )}

            <div className="flex justify-end space-x-2.5 pt-3 border-t border-gray-200">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteAction}
                disabled={actionLoading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 shadow-sm"
              >
                {actionLoading && <Icons.Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderDetailsPage;
