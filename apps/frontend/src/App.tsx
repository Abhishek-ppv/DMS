import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { PartnersPage } from './pages/PartnersPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { ProductsPage } from './pages/ProductsPage';
import { InventoryPage } from './pages/InventoryPage';
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage';
import { CreatePurchaseOrderPage } from './pages/CreatePurchaseOrderPage';
import { PurchaseOrderDetailsPage } from './pages/PurchaseOrderDetailsPage';
import { PurchaseOrderApprovalsPage } from './pages/PurchaseOrderApprovalsPage';
import { POSPage } from './pages/POSPage';
import { SalesOrdersHistoryPage } from './pages/SalesOrdersHistoryPage';
import { SalesOrderDetailsPage } from './pages/SalesOrderDetailsPage';
import { Placeholder } from './pages/Placeholder';

const LoginRedirect: React.FC = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public login route */}
          <Route path="/login" element={<LoginRedirect />} />

          {/* Protected dashboard shell */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* Redirect root to dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />
            
            {/* Dashboard main page */}
            <Route path="dashboard" element={<Dashboard />} />
            
            {/* Module pages */}
            <Route path="products" element={<ProductsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="partners" element={<PartnersPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="orders" element={<PurchaseOrdersPage />} />
            
            {/* Purchase Order Pages */}
            <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="purchase-orders/create" element={<CreatePurchaseOrderPage />} />
            <Route path="purchase-orders/approvals" element={<PurchaseOrderApprovalsPage />} />
            <Route path="purchase-orders/:id" element={<PurchaseOrderDetailsPage />} />
            
            {/* POS & Sales Order Pages */}
            <Route path="pos" element={<POSPage />} />
            <Route path="sales-orders" element={<SalesOrdersHistoryPage />} />
            <Route path="sales-orders/:id" element={<SalesOrderDetailsPage />} />
            
            <Route path="finance" element={<Placeholder />} />
          </Route>

          {/* Fallback wildcard route */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
