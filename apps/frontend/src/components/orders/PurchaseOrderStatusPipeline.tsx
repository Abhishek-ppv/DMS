import React from 'react';
import * as Icons from 'lucide-react';
import { OrderStatus } from '../../types/purchase-order';

interface PipelineProps {
  status: OrderStatus;
}

const LIFECYCLE_STAGES: { key: OrderStatus; label: string; description: string }[] = [
  { key: 'PLACED', label: 'Placed', description: 'Submitted by Buyer' },
  { key: 'APPROVED', label: 'Approved', description: 'Stock Allocated' },
  { key: 'DISPATCHED', label: 'Dispatched', description: 'In Transit' },
  { key: 'DELIVERED', label: 'Delivered', description: 'Received by Buyer' },
  { key: 'INVOICED', label: 'Invoiced', description: 'Billing Completed' },
];

export const PurchaseOrderStatusPipeline: React.FC<PipelineProps> = ({ status }) => {
  if (status === 'DRAFT') {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
            <Icons.FileEdit className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-amber-900">Order Lifecycle: DRAFT</h4>
            <p className="text-amber-700">This Purchase Order is a draft and has not been placed yet.</p>
          </div>
        </div>
        <span className="px-3 py-0.5 bg-white border border-amber-300 text-amber-800 font-bold rounded-full text-[10px] uppercase">
          Draft State
        </span>
      </div>
    );
  }

  if (status === 'REJECTED') {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-red-100 text-red-700 rounded-lg">
            <Icons.XCircle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-red-900">Order Status: REJECTED</h4>
            <p className="text-red-700">This Purchase Order was rejected during approval review.</p>
          </div>
        </div>
        <span className="px-3 py-0.5 bg-white border border-red-300 text-red-700 font-bold rounded-full text-[10px] uppercase">
          Rejected
        </span>
      </div>
    );
  }

  if (status === 'CANCELLED') {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gray-200 text-gray-600 rounded-lg">
            <Icons.Ban className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-gray-800">Order Status: CANCELLED</h4>
            <p className="text-gray-500">This Purchase Order has been cancelled.</p>
          </div>
        </div>
        <span className="px-3 py-0.5 bg-white border border-gray-300 text-gray-600 font-bold rounded-full text-[10px] uppercase">
          Cancelled
        </span>
      </div>
    );
  }

  const stageKeys = LIFECYCLE_STAGES.map((s) => s.key);
  let currentIndex = stageKeys.indexOf(status);
  if (currentIndex === -1) {
    if (status === 'SUBMITTED') currentIndex = 0;
    else if (status === 'PROCESSING') currentIndex = 1;
    else if (status === 'COMPLETED') currentIndex = 4;
    else currentIndex = 0;
  }

  return (
    <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <h3 className="text-xs font-bold text-gray-800 tracking-wide uppercase flex items-center gap-2">
          <Icons.Activity className="w-4 h-4 text-blue-600" />
          Purchase Order Lifecycle Pipeline
        </h3>
        <span className="text-xs text-gray-500 font-mono">
          Stage {currentIndex + 1} of {LIFECYCLE_STAGES.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {LIFECYCLE_STAGES.map((stage, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <div
              key={stage.key}
              className={`flex flex-col p-3 rounded-lg border text-xs transition ${
                isCurrent
                  ? 'bg-blue-50 border-blue-300 shadow-sm'
                  : isCompleted
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-gray-50 border-gray-200 text-gray-400'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    isCompleted
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : isCurrent
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isCompleted ? <Icons.Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                {isCurrent && (
                  <span className="px-2 py-0.5 bg-blue-100 border border-blue-300 text-[9px] font-bold text-blue-800 uppercase rounded">
                    Active
                  </span>
                )}
                {isCompleted && (
                  <span className="text-emerald-700 text-[10px] font-bold">✓ Done</span>
                )}
              </div>

              <h4
                className={`font-bold text-xs mb-0.5 ${
                  isCurrent
                    ? 'text-blue-900'
                    : isCompleted
                    ? 'text-emerald-900'
                    : 'text-gray-500'
                }`}
              >
                {stage.label}
              </h4>
              <p className="text-[11px] text-gray-500 leading-snug">{stage.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PurchaseOrderStatusPipeline;
