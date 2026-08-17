import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { purchaseOrdersService } from '../services/purchase-orders.service';
import { PurchaseOrder, OrderStatus } from '../types/purchase-order';
import * as Icons from 'lucide-react';

const STATUS_BADGE_CLASSES: Record<OrderStatus, string> = {
  DRAFT: 'bg-amber-50 border-amber-200 text-amber-700',
  PLACED: 'bg-blue-50 border-blue-200 text-blue-700',
  SUBMITTED: 'bg-blue-50 border-blue-200 text-blue-700',
  APPROVED: 'bg-teal-50 border-teal-200 text-teal-700',
  PROCESSING: 'bg-purple-50 border-purple-200 text-purple-700',
  DISPATCHED: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  DELIVERED: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  INVOICED: 'bg-cyan-50 border-cyan-200 text-cyan-700',
  COMPLETED: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  CANCELLED: 'bg-gray-100 border-gray-200 text-gray-600',
  REJECTED: 'bg-rose-50 border-rose-200 text-rose-700',
};

export const PurchaseOrdersPage: React.FC = () => {
  const { permissions, user } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const canCreate = permissions.some((p) => p.resource === 'ORDER' && p.action === 'CREATE');
  const canUpdate = permissions.some((p) => p.resource === 'ORDER' && p.action === 'UPDATE');

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await purchaseOrdersService.getAll(
        statusFilter !== 'ALL' ? { status: statusFilter as OrderStatus } : undefined,
      );
      setOrders(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const filteredOrders = orders.filter((po) => {
    const query = searchQuery.toLowerCase();
    const poNumMatch = po.orderNumber.toLowerCase().includes(query);
    const buyerMatch = po.buyerPartner?.name?.toLowerCase().includes(query);
    const sellerMatch = po.sellerPartner?.name?.toLowerCase().includes(query);
    return poNumMatch || buyerMatch || sellerMatch;
  });

  const formatCurrency = (val: number | string) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(num);
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
            <Icons.ShoppingCart className="w-6 h-6 text-blue-600" />
            Purchase Orders
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            Manage procurement purchase orders, approval workflows, and stock tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canUpdate && (
            <Link
              to="/purchase-orders/approvals"
              className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg text-xs font-semibold transition flex items-center gap-2"
            >
              <Icons.CheckSquare className="w-4 h-4 text-blue-600" />
              <span>Approval Queue</span>
            </Link>
          )}

          {canCreate && (
            <Link
              to="/purchase-orders/create"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition shadow-sm flex items-center gap-2"
            >
              <Icons.Plus className="w-4 h-4" />
              <span>Create Purchase Order</span>
            </Link>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Icons.Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search PO Number, Buyer, Seller..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600"
          />
        </div>

        {/* Status Filter Dropdown */}
        <div className="flex items-center space-x-2.5 w-full md:w-auto">
          <span className="text-xs text-gray-500 font-semibold uppercase">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-blue-600"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="PLACED">PLACED</option>
            <option value="APPROVED">APPROVED</option>
            <option value="DISPATCHED">DISPATCHED</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="INVOICED">INVOICED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700 text-xs font-medium">
          <Icons.AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-500 text-xs space-y-2">
            <Icons.Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
            <p>Loading purchase orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-xs space-y-2">
            <div className="p-3 bg-gray-100 rounded-full w-10 h-10 flex items-center justify-center mx-auto text-gray-400">
              <Icons.FileText className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">No Purchase Orders Found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              There are no purchase orders matching your current query or permissions.
            </p>
            {canCreate && (
              <div className="pt-2">
                <Link
                  to="/purchase-orders/create"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold"
                >
                  <Icons.Plus className="w-4 h-4" />
                  <span>Create First Order</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-5">PO Number</th>
                  <th className="py-3 px-5">Buyer Partner</th>
                  <th className="py-3 px-5">Seller Partner</th>
                  <th className="py-3 px-5">Total Amount</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {filteredOrders.map((po) => {
                  const badgeClass = STATUS_BADGE_CLASSES[po.status] || 'bg-gray-100 text-gray-600';

                  return (
                    <tr key={po.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3.5 px-5 font-mono font-bold text-blue-700">
                        {po.orderNumber}
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-gray-900">
                        {po.buyerPartner?.name || 'Unknown Buyer'}
                        <div className="text-[10px] text-gray-400 font-normal uppercase">
                          {po.buyerPartner?.type}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-gray-800">
                        {po.sellerPartner?.name || 'Unknown Seller'}
                        <div className="text-[10px] text-gray-400 font-normal uppercase">
                          {po.sellerPartner?.type}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 font-bold text-gray-900">
                        {formatCurrency(po.totalAmount)}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}`}>
                          {po.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-xs text-gray-500 font-mono">
                        {formatDate(po.createdAt)}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <Link
                          to={`/purchase-orders/${po.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md text-xs font-semibold transition"
                        >
                          <Icons.Eye className="w-3.5 h-3.5 text-gray-400" />
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseOrdersPage;
