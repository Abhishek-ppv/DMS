import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { purchaseOrdersService } from '../services/purchase-orders.service';
import { PurchaseOrder } from '../types/purchase-order';
import * as Icons from 'lucide-react';

export const PurchaseOrderApprovalsPage: React.FC = () => {
  const { user } = useAuth();
  const [approvalQueue, setApprovalQueue] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active Action State
  const [activePo, setActivePo] = useState<PurchaseOrder | null>(null);
  const [activeAction, setActiveAction] = useState<'approve' | 'reject' | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const [placedOrders, submittedOrders] = await Promise.all([
        purchaseOrdersService.getAll({ status: 'PLACED' }),
        purchaseOrdersService.getAll({ status: 'SUBMITTED' }),
      ]);

      const combined = [...placedOrders, ...submittedOrders];
      const uniqueMap = new Map<string, PurchaseOrder>();
      combined.forEach((po) => uniqueMap.set(po.id, po));
      const list = Array.from(uniqueMap.values());

      const myQueue = list.filter((po) => {
        if (user?.role === 'ADMIN') return true;
        return user?.partnerId && po.sellerPartnerId === user.partnerId;
      });

      setApprovalQueue(myQueue);
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase order approval queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [user]);

  const formatCurrency = (val: number | string) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(num);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handleConfirmAction = async () => {
    if (!activePo || !activeAction) return;
    setActionLoading(true);
    setError(null);
    try {
      if (activeAction === 'approve') {
        await purchaseOrdersService.approve(activePo.id);
      } else {
        await purchaseOrdersService.reject(activePo.id);
      }
      setActivePo(null);
      setActiveAction(null);
      await fetchQueue();
    } catch (err: any) {
      setError(err.message || `Failed to ${activeAction} purchase order`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <Link to="/purchase-orders" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-1 font-semibold">
            <Icons.ArrowLeft className="w-3.5 h-3.5" /> Back to Purchase Orders
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
            <Icons.CheckSquare className="w-6 h-6 text-blue-600" />
            Purchase Order Approval Queue
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            Review and approve pending purchase orders submitted by your partner network.
          </p>
        </div>

        <button
          onClick={fetchQueue}
          className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-gray-300 self-start sm:self-auto"
        >
          <Icons.RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center space-x-2 text-xs font-medium">
          <Icons.AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <Icons.X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Queue Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-500 text-xs space-y-2">
            <Icons.Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
            <p>Loading approval queue...</p>
          </div>
        ) : approvalQueue.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-xs space-y-2">
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-full w-10 h-10 flex items-center justify-center mx-auto border border-emerald-200">
              <Icons.CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Approval Queue Empty</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              There are no purchase orders waiting for your approval at this time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-5">PO Number</th>
                  <th className="py-3 px-5">Buyer Partner</th>
                  <th className="py-3 px-5">Total Amount</th>
                  <th className="py-3 px-5">Date Placed</th>
                  <th className="py-3 px-5 text-right">Approval Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {approvalQueue.map((po) => (
                  <tr key={po.id} className="hover:bg-gray-50/70 transition">
                    <td className="py-3.5 px-5 font-mono font-bold text-blue-700">
                      {po.orderNumber}
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-gray-900">
                      {po.buyerPartner?.name}
                      <div className="text-[10px] text-gray-400 font-normal uppercase">
                        {po.buyerPartner?.type}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 font-bold font-mono text-blue-700">
                      {formatCurrency(po.totalAmount)}
                    </td>
                    <td className="py-3.5 px-5 text-xs text-gray-500 font-mono">
                      {formatDate(po.createdAt)}
                    </td>
                    <td className="py-3.5 px-5 text-right space-x-2">
                      <Link
                        to={`/purchase-orders/${po.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md text-xs font-semibold"
                      >
                        <Icons.Eye className="w-3.5 h-3.5" />
                        View
                      </Link>

                      <button
                        onClick={() => {
                          setActivePo(po);
                          setActiveAction('reject');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-red-300 hover:bg-red-50 text-red-600 rounded-md text-xs font-semibold"
                      >
                        <Icons.XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>

                      <button
                        onClick={() => {
                          setActivePo(po);
                          setActiveAction('approve');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-sm"
                      >
                        <Icons.CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {activePo && activeAction && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
            <div className="flex items-center space-x-2 text-blue-600">
              <Icons.HelpCircle className="w-5 h-5" />
              <h3 className="text-base font-bold text-gray-900 uppercase">
                Confirm {activeAction}
              </h3>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Are you sure you want to <strong className="text-gray-900 uppercase">{activeAction}</strong> Purchase Order{' '}
              <strong className="text-blue-700 font-mono">{activePo.orderNumber}</strong> from{' '}
              <strong className="text-gray-900">{activePo.buyerPartner?.name}</strong> for{' '}
              <strong className="text-blue-700 font-mono font-bold">{formatCurrency(activePo.totalAmount)}</strong>?
            </p>

            {activeAction === 'approve' && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-800 space-y-1">
                <p className="font-bold">⚠️ Stock Movement Notice</p>
                <p>Approving this order will automatically allocate stock and transfer inventory to the buyer's warehouse.</p>
              </div>
            )}

            <div className="flex justify-end space-x-2.5 pt-3 border-t border-gray-200">
              <button
                onClick={() => {
                  setActivePo(null);
                  setActiveAction(null);
                }}
                className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={actionLoading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 shadow-sm"
              >
                {actionLoading && <Icons.Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm {activeAction}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderApprovalsPage;
