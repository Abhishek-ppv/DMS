import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { LogOut, Shield, ChevronDown, Building, Globe } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="bg-white border-b border-gray-200 h-16 px-6 flex items-center justify-between text-gray-900 relative z-30 shrink-0">
      {/* Scoped Partner Organization Indicator */}
      <div className="flex items-center space-x-3 text-gray-700">
        {user?.partnerDetails ? (
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-blue-50 border border-blue-100 rounded-md text-blue-600">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-xs text-gray-900 block leading-tight">
                {user.partnerDetails.name}
              </span>
              {user.partnerDetails.territory && (
                <span className="text-[10px] text-gray-500 font-medium flex items-center space-x-1">
                  <Globe className="w-3 h-3 mr-0.5 inline text-gray-400" />
                  {user.partnerDetails.territory} Organization
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-emerald-50 border border-emerald-100 rounded-md text-emerald-600">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-xs text-emerald-700 block leading-tight">
                System Administrator
              </span>
              <span className="text-[10px] text-gray-500 font-medium">
                Unrestricted Global Scope
              </span>
            </div>
          </div>
        )}
      </div>

      {/* User Actions */}
      <div className="flex items-center space-x-4">
        {/* User Card & Dropdown Toggle */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2.5 p-1.5 px-2.5 rounded-lg hover:bg-gray-100/70 border border-transparent hover:border-gray-200 transition-colors focus:outline-none"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs">
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div className="hidden md:block text-left">
              <span className="block text-xs font-bold text-gray-800 leading-tight">
                {user?.name}
              </span>
              <span className="block text-[10px] text-gray-500 font-medium">
                {user?.role}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <>
              {/* Overlay to close */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              ></div>
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-20 animate-in fade-in duration-100 text-xs">
                <div className="px-3 py-2 border-b border-gray-100 mb-1">
                  <span className="block text-[10px] text-gray-400 uppercase font-semibold">Signed in as</span>
                  <span className="block text-xs font-semibold font-mono text-gray-800 truncate mt-0.5">
                    {user?.email}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-2 px-3 py-2 rounded-md text-red-600 hover:bg-red-50 transition-colors text-left font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
