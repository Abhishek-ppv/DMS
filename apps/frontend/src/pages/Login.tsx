import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ShieldCheck, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; api?: string }>({});
  const [loading, setLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const validate = () => {
    const tempErrors: typeof errors = {};
    if (!email) {
      tempErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      tempErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      tempErrors.password = 'Password is required';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validate()) return;

    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setErrors({
        api: err.message || 'Login failed. Please check your credentials.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col items-center justify-center p-4">
      {/* Brand Logo Header */}
      <div className="flex items-center space-x-3 mb-8">
        <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            DealerFlow DMS
          </h1>
          <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">
            Enterprise Dealer Portal
          </p>
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900">Welcome Back</h2>
          <p className="text-xs text-gray-500 mt-0.5">Sign in to manage your dealer dashboard</p>
        </div>

        {/* API Error Alert */}
        {errors.api && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3 text-red-700 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="font-medium">{errors.api}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email field */}
          <div className="space-y-1">
            <label htmlFor="email" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="email"
                type="text"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className={`w-full bg-white border ${
                  errors.email ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600'
                } rounded-lg pl-9 pr-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none transition`}
              />
            </div>
            {errors.email && (
              <span className="text-xs text-red-600 block font-medium mt-1">
                {errors.email}
              </span>
            )}
          </div>

          {/* Password field */}
          <div className="space-y-1">
            <label htmlFor="password" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className={`w-full bg-white border ${
                  errors.password ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600'
                } rounded-lg pl-9 pr-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none transition`}
              />
            </div>
            {errors.password && (
              <span className="text-xs text-red-600 block font-medium mt-1">
                {errors.password}
              </span>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 px-4 rounded-lg transition flex items-center justify-center space-x-2 text-sm shadow-sm mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>
      </div>

      {/* Footer Details */}
      <div className="mt-8 text-center text-xs text-gray-500 font-mono">
        DealerFlow DMS — Secure Authentication Guard
      </div>
    </div>
  );
};
export default Login;
