import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { salesOrdersService, SalesOrder } from '../services/sales-orders.service';

export const SalesOrderDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchOrderDetails(id);
    }
  }, [id]);

  const fetchOrderDetails = async (orderId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await salesOrdersService.getSalesOrderById(orderId);
      setOrder(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load Sales Order details');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-gray-500 text-xs flex flex-col items-center justify-center gap-2">
        <Icons.Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span>Loading Sales Order details...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto text-xs">
        <button
          onClick={() => navigate('/sales-orders')}
          className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
        >
          <Icons.ArrowLeft className="w-4 h-4" />
          <span>Back to Sales Orders</span>
        </button>

        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-lg flex items-center gap-2">
          <Icons.AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error || 'Sales Order not found'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-xs">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/sales-orders')}
          className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
        >
          <Icons.ArrowLeft className="w-4 h-4" />
          <span>Back to Sales Orders</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-semibold uppercase">Status:</span>
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-0.5 rounded text-xs font-bold font-mono uppercase">
            {order.status}
          </span>
        </div>
      </div>

      {/* Main Order Details Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row justify-between pb-4 border-b border-gray-200 gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg text-blue-600">
                <Icons.Receipt className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 font-mono">
                  {order.orderNumber}
                </h1>
                <p className="text-xs text-gray-500">
                  Date: {new Date(order.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="sm:text-right">
            <span className="text-xs text-gray-500 font-semibold block uppercase">Total Amount</span>
            <span className="text-xl font-extrabold text-blue-700 font-mono">
              ₹{Number(order.totalAmount).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Customer & Partner Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-1">
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">
              Customer Information
            </span>
            <div className="text-xs font-bold text-gray-900">{order.customer?.name || 'N/A'}</div>
            <div className="text-xs text-gray-600">Phone: {order.customer?.phone || 'N/A'}</div>
            {order.customer?.email && <div className="text-xs text-gray-600">Email: {order.customer.email}</div>}
            {order.customer?.address && <div className="text-xs text-gray-500">Address: {order.customer.address}</div>}
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-1">
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">
              Seller Partner Organization
            </span>
            <div className="text-xs font-bold text-gray-900">{order.sellerPartner?.name || 'N/A'}</div>
            <div className="text-xs text-gray-600">Partner Type: {order.sellerPartner?.type || 'DEALER'}</div>
          </div>
        </div>

        {/* Order Line Items */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            Order Line Items ({order.lines?.length || 0})
          </h3>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50 text-gray-700 font-semibold uppercase border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-4 py-2.5">SKU / IMEI</th>
                  <th className="px-4 py-2.5 text-center">Qty</th>
                  <th className="px-4 py-2.5 text-right">Unit Price</th>
                  <th className="px-4 py-2.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {order.lines && order.lines.length > 0 ? (
                  order.lines.map((line) => (
                    <tr key={line.id} className="hover:bg-gray-50/70 transition">
                      <td className="px-4 py-3 font-bold text-gray-900">
                        {line.product?.name || 'Unknown Product'}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <div>SKU: {line.product?.SKU || 'N/A'}</div>
                        {line.inventoryItem?.IMEI && (
                          <div className="text-emerald-700 text-[11px] font-bold mt-0.5 flex items-center gap-1">
                            <Icons.QrCode className="w-3.5 h-3.5" />
                            <span>IMEI: {line.inventoryItem.IMEI}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-bold font-mono text-gray-900">
                        {line.quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">
                        ₹{Number(line.unitPrice).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-blue-700">
                        ₹{Number(line.total).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-gray-400">
                      No line items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Order Totals Summary */}
        <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5 text-xs max-w-xs ml-auto">
          <div className="flex justify-between text-gray-600">
            <span>Tax Total:</span>
            <span className="font-mono text-gray-900">₹{Number(order.taxAmount || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-gray-900 pt-1.5 border-t border-gray-200">
            <span>Grand Total:</span>
            <span className="font-mono text-blue-700 font-extrabold">₹{Number(order.totalAmount).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesOrderDetailsPage;
