import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Layout } from 'lucide-react';

export const Placeholder: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  
  const name = location.pathname.substring(1);
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm h-96 flex flex-col items-center justify-center text-center">
      <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-600 mb-4">
        <Layout className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{capitalized} Module</h2>
      <p className="text-gray-500 max-w-md text-xs mb-6">
        This is a placeholder page for the {capitalized} feature. It is currently protected for your
        account role ({user?.role}) and scoped under your partner organization.
      </p>
      <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        Enterprise Module Active
      </div>
    </div>
  );
};
export default Placeholder;
