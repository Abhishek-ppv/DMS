import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { navigationConfig, NavigationItem } from '../navigation';

export const Sidebar: React.FC = () => {
  const { permissions, user } = useAuth();
  const location = useLocation();

  const userHasPermission = (item: NavigationItem) => {
    if (item.roles && user?.role) {
      if (!item.roles.includes(user.role)) return false;
    }
    if (!item.permission) return true;
    return permissions.some(
      (p) =>
        p.resource === item.permission?.resource &&
        p.action === item.permission?.action
    );
  };

  const filteredNavigation = navigationConfig.filter(userHasPermission);

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col h-full shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-gray-200 flex items-center space-x-3 bg-white">
        <div className="p-1.5 bg-blue-50 border border-blue-100 rounded-lg text-blue-600">
          <Icons.ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold tracking-tight text-gray-900 leading-tight">
            DealerFlow DMS
          </h2>
          <span className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">
            Enterprise Portal
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNavigation.map((item) => {
          const IconComponent = (Icons as any)[item.icon] || Icons.HelpCircle;
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path));

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs transition-colors ${
                isActive
                  ? 'bg-blue-50/80 text-blue-700 font-semibold border-l-4 border-blue-600 -ml-3 pl-5'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60 font-medium'
              }`}
            >
              <IconComponent
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3.5 border-t border-gray-200 bg-gray-50 text-center">
        <span className="text-[11px] text-gray-500 font-mono">
          System Ver. 1.0.3
        </span>
      </div>
    </aside>
  );
};

export default Sidebar;
