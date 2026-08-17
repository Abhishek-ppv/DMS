import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { salesOrdersService, SalesOrder } from '../services/sales-orders.service';
import { useAuth } from '../auth/AuthContext';

export const SalesOrdersHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canCreatePOS = user?.role === 'DEALER' || user?.role === 'DIRECT_DEALER' || user?.role === 'ADMIN';

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await salesOrdersService.getSalesOrders();
      setOrders(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load Sales Orders history');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const term = search.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(term) ||
      (o.customer && o.customer.name.toLowerCase().includes(term)) ||
      (o.customer && o.customer.phone.includes(term)) ||
      o.status.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg text-blue-600">
            <Icons.Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Sales Orders History</h1>
            <p className="text-xs text-gray-500">
              Partner-scoped history of retail customer sales transactions
            </p>
          </div>
        </div>

        {canCreatePOS && (
          <button
            onClick={() => navigate('/pos')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
          >
            <Icons.Plus className="w-4 h-4" />
            <span>+ New POS Sale</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between text-xs">
        <div className="relative w-full sm:w-80">
          <Icons.Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by order number or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3.5 py-2 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600"
          />
        </div>

        <button
          onClick={fetchOrders}
          className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <Icons.RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-lg flex items-center gap-2">
          <Icons.AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm text-xs">
        {isLoading ? (
          <div className="py-16 text-center text-gray-500 text-xs flex flex-col items-center justify-center gap-2">
            <Icons.Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span>Loading sales orders...</span>
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-gray-700 font-semibold uppercase border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3.5">Order Number</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Total Amount</th>
                  <th className="px-5 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => navigate(`/sales-orders/${order.id}`)}
                    className="hover:bg-gray-50/70 cursor-pointer transition"
                  >
                    <td className="px-5 py-3.5 font-mono font-bold text-blue-700">
                      {order.orderNumber}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-gray-900">
                        {order.customer?.name || 'N/A'}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {order.customer?.phone || ''}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                        {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-extrabold text-gray-900">
                      ₹{Number(order.totalAmount).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/sales-orders/${order.id}`);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded transition"
                        title="View Details"
                      >
                        <Icons.ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center space-y-2">
            <Icons.Receipt className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="text-xs font-bold text-gray-700">No Sales Orders Found</p>
            <p className="text-xs text-gray-500">
              {search ? `No orders matching "${search}"` : 'No completed sales orders recorded yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesOrdersHistoryPage;
