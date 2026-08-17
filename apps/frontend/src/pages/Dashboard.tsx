import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { Shield, Briefcase, ShoppingBag, Award, CheckCircle2 } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user, permissions } = useAuth();

  const getRoleBadgeColor = () => {
    switch (user?.role) {
      case 'ADMIN':
        return 'bg-purple-50 border-purple-200 text-purple-700';
      case 'SUPPLIER':
        return 'bg-teal-50 border-teal-200 text-teal-700';
      case 'DISTRIBUTOR':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'DEALER':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case 'DIRECT_DEALER':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      default:
        return 'bg-gray-100 border-gray-200 text-gray-700';
    }
  };

  const getRoleIcon = () => {
    switch (user?.role) {
      case 'ADMIN':
        return <Shield className="w-8 h-8 text-purple-600" />;
      case 'SUPPLIER':
        return <Award className="w-8 h-8 text-teal-600" />;
      default:
        return <Briefcase className="w-8 h-8 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Dashboard Overview
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Real-time business scope and role-based permissions
          </p>
        </div>
        <div className="mt-3 md:mt-0 flex items-center space-x-2">
          <span className="text-xs text-gray-500 font-medium">Session Role:</span>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getRoleBadgeColor()}`}
          >
            {user?.role}
          </span>
        </div>
      </div>

      {/* Greeting Banner */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="max-w-3xl">
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            Welcome back, {user?.name}!
          </h2>
          <p className="text-gray-600 text-xs leading-relaxed">
            You are logged into the DealerFlow DMS platform. Below is your active session context.
            Navigation items are dynamically filtered based on your organization role and permissions.
          </p>
        </div>
      </div>

      {/* Scope Details Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Access Role & Permissions Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-start space-x-4">
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            {getRoleIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
              Identity Access Context
            </span>
            <h3 className="text-base font-bold text-gray-900 mt-0.5">
              {user?.roleDetails?.name || user?.role} Account
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {user?.roleDetails?.description || 'Scoped user account'}
            </p>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="text-gray-500">Granted Permissions:</span>
              <span className="font-semibold text-blue-600">{permissions.length} active keys</span>
            </div>
          </div>
        </div>

        {/* Partner Scoping isolation Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-start space-x-4">
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <ShoppingBag className="w-8 h-8 text-teal-600" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
              Data Scope & Tenant
            </span>
            <h3 className="text-base font-bold text-gray-900 mt-0.5">
              {user?.partnerDetails?.name || 'Global System Scope'}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {user?.partnerDetails ? (
                <>Organization Type: <span className="font-semibold text-teal-700">{user.partnerDetails.type}</span></>
              ) : (
                'System administrator unrestricted access'
              )}
            </p>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="text-gray-500">Scoping Isolation:</span>
              <span className="font-mono text-teal-700 font-medium">
                {user?.partnerId ? `PartnerID Scoped` : 'Global Admin (Unscoped)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Permissions Matrix Log */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-xs font-semibold text-gray-700 mb-3 flex items-center">
          <CheckCircle2 className="w-4 h-4 mr-2 text-blue-600" />
          Active Granted Permission Keys
        </h3>
        {permissions.length === 0 ? (
          <p className="text-xs text-gray-400">No specific database permissions loaded.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {permissions.map((p, idx) => (
              <div
                key={idx}
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-center text-xs"
              >
                <span className="font-mono font-bold text-gray-800">
                  {p.resource}
                </span>
                <span className="mx-1 text-gray-400">:</span>
                <span className="text-gray-600">{p.action}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
export default Dashboard;
