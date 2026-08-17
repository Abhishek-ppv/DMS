import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/api';
import * as Icons from 'lucide-react';

export interface Product {
  id: string;
  SKU: string;
  name: string;
  brand: string;
  categoryId: string;
  category?: { id: string; name: string };
  model: string | null;
  description: string | null;
  MRP: number | string;
  price?: number | string;
  supplierPrice?: number | string;
  distributorPrice?: number | string;
  dealerPrice?: number | string;
  directDealerPrice?: number | string;
  tax: number | string;
  warrantyPeriod: number;
  IMEITracked: boolean;
  status: string;
}

export interface CategoryOption {
  id: string;
  name: string;
}

export const ProductsPage: React.FC = () => {
  const { user, permissions } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [model, setModel] = useState('');
  const [description, setDescription] = useState('');
  const [mrp, setMrp] = useState<number>(0);
  const [supplierPrice, setSupplierPrice] = useState<number>(0);
  const [distributorPrice, setDistributorPrice] = useState<number>(0);
  const [dealerPrice, setDealerPrice] = useState<number>(0);
  const [directDealerPrice, setDirectDealerPrice] = useState<number>(0);
  const [tax, setTax] = useState<number>(18);
  const [warrantyPeriod, setWarrantyPeriod] = useState<number>(12);
  const [imeiTracked, setImeiTracked] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  const canCreate = permissions.some((p) => p.resource === 'PRODUCT' && p.action === 'CREATE');
  const canUpdate = permissions.some((p) => p.resource === 'PRODUCT' && p.action === 'UPDATE');
  const canDelete = permissions.some((p) => p.resource === 'PRODUCT' && p.action === 'DELETE');

  const isFullCatalogAdmin = canCreate || canUpdate || user?.role === 'ADMIN' || user?.role === 'SUPPLIER';

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    let prodErr: string | null = null;
    let catErr: string | null = null;

    try {
      const prodsData = await api.get<Product[]>('/products');
      setProducts(prodsData);
    } catch (err: any) {
      prodErr = err.message || 'Failed to load products';
    }

    try {
      const catsData = await api.get<CategoryOption[]>('/categories');
      setCategories(catsData);
      if (catsData.length > 0 && !categoryId) {
        setCategoryId(catsData[0].id);
      }
    } catch (err: any) {
      catErr = err.message || 'Failed to load categories';
    }

    if (prodErr || catErr) {
      setError(prodErr || catErr);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModal = async (product?: Product) => {
    try {
      const catsData = await api.get<CategoryOption[]>('/categories');
      setCategories(catsData);
      if (product) {
        setEditingProduct(product);
        setSku(product.SKU);
        setName(product.name);
        setBrand(product.brand);
        setCategoryId(product.categoryId);
        setModel(product.model || '');
        setDescription(product.description || '');
        setMrp(Number(product.MRP));
        setSupplierPrice(Number(product.supplierPrice ?? product.MRP));
        setDistributorPrice(Number(product.distributorPrice ?? product.MRP));
        setDealerPrice(Number(product.dealerPrice ?? product.MRP));
        setDirectDealerPrice(Number(product.directDealerPrice ?? product.MRP));
        setTax(Number(product.tax));
        setWarrantyPeriod(Number(product.warrantyPeriod));
        setImeiTracked(Boolean(product.IMEITracked));
      } else {
        setEditingProduct(null);
        setSku('');
        setName('');
        setBrand('Apex');
        setCategoryId(catsData.length > 0 ? catsData[0].id : (categories.length > 0 ? categories[0].id : ''));
        setModel('');
        setDescription('');
        setMrp(89999);
        setSupplierPrice(50000);
        setDistributorPrice(60000);
        setDealerPrice(68000);
        setDirectDealerPrice(65000);
        setTax(18);
        setWarrantyPeriod(12);
        setImeiTracked(true);
      }
    } catch (err: any) {
      if (product) {
        setEditingProduct(product);
        setCategoryId(product.categoryId);
      }
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      SKU: sku,
      name,
      brand,
      categoryId,
      model: model || undefined,
      description: description || undefined,
      MRP: Number(mrp),
      supplierPrice: Number(supplierPrice),
      distributorPrice: Number(distributorPrice),
      dealerPrice: Number(dealerPrice),
      directDealerPrice: Number(directDealerPrice),
      tax: Number(tax),
      warrantyPeriod: Number(warrantyPeriod),
      IMEITracked: imeiTracked,
    };

    try {
      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, payload);
      } else {
        await api.post('/products', payload);
      }

      setIsModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    setError(null);
    try {
      await api.delete(`/products/${id}`);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete product');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
            <Icons.Package className="w-6 h-6 text-blue-600" />
            Product Catalog
          </h1>
          <p className="text-gray-500 text-xs mt-1 flex items-center gap-2">
            <span>{isFullCatalogAdmin ? 'Supplier & Admin Catalog Management' : 'Partner Product Catalog'}</span>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-mono font-semibold">
              Tier: {user?.role || 'READ_ONLY'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-300 transition flex items-center gap-2 text-xs font-medium"
          >
            <Icons.RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {canCreate && (
            <button
              onClick={() => openModal()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition flex items-center gap-2 shadow-sm"
            >
              <Icons.Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <Icons.AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <Icons.X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Products Catalog Container */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center justify-between">
          <span>{isFullCatalogAdmin ? 'Master Product Catalog' : 'Available Catalog Products'}</span>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-md">
            Total: {products.length} Products
          </span>
        </h2>

        {loading ? (
          <div className="py-16 text-center text-gray-500 text-xs flex flex-col items-center gap-2">
            <Icons.Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p>Loading catalog...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="py-12 text-center text-gray-500 border border-dashed border-gray-200 rounded-lg text-xs">
            <Icons.Package className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p>No products found in catalog.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((prod) => (
              <div
                key={prod.id}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition flex flex-col justify-between space-y-4 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      SKU: {prod.SKU}
                    </span>
                    {prod.IMEITracked ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                        <Icons.QrCode className="w-3 h-3" /> IMEI Tracked
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                        Batch Product
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-gray-900 text-base">{prod.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Brand: <span className="text-gray-800 font-semibold">{prod.brand}</span> | Category:{' '}
                    <span className="text-gray-800 font-semibold">{prod.category?.name || 'Uncategorized'}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{prod.description || 'No description provided'}</p>
                </div>

                <div className="space-y-3 pt-3 border-t border-gray-100">
                  {/* Pricing Display */}
                  {isFullCatalogAdmin && prod.supplierPrice !== undefined ? (
                    /* Admin / Supplier Multi-Tier Pricing Matrix */
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <span className="text-gray-500 block text-[10px] font-semibold">MRP:</span>
                        <span className="font-mono font-bold text-gray-900">₹{Number(prod.MRP).toLocaleString()}</span>
                      </div>
                      <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <span className="text-gray-500 block text-[10px] font-semibold">Supplier:</span>
                        <span className="font-mono font-bold text-purple-700">₹{Number(prod.supplierPrice).toLocaleString()}</span>
                      </div>
                      <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <span className="text-gray-500 block text-[10px] font-semibold">Distributor:</span>
                        <span className="font-mono font-bold text-blue-700">₹{Number(prod.distributorPrice).toLocaleString()}</span>
                      </div>
                      <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <span className="text-gray-500 block text-[10px] font-semibold">Dealer:</span>
                        <span className="font-mono font-bold text-emerald-700">₹{Number(prod.dealerPrice).toLocaleString()}</span>
                      </div>
                    </div>
                  ) : (
                    /* Read-Only Tier Catalog */
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">MRP</span>
                        <span className="font-mono text-xs text-gray-400 line-through">₹{Number(prod.MRP).toLocaleString()}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider block">Your Tier Price</span>
                        <span className="font-mono text-base font-extrabold text-blue-700">
                          ₹{Number(prod.price ?? prod.MRP).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                    <span>Warranty: {prod.warrantyPeriod} Months</span>
                    <span>Tax: {Number(prod.tax)}%</span>
                  </div>

                  {(canUpdate || canDelete) && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                      {canUpdate && (
                        <button
                          onClick={() => openModal(prod)}
                          className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                        >
                          <Icons.Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(prod.id)}
                          className="px-3 py-1.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                        >
                          <Icons.Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Product Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-xl w-full max-w-lg p-6 shadow-xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1 uppercase">SKU *</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="APX-X200-128GB"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 font-mono text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1 uppercase">Category *</label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    {categories.length === 0 ? (
                      <option value="" disabled>No Categories Found</option>
                    ) : (
                      <option value="" disabled>Select Category</option>
                    )}
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1 uppercase">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Galaxy X200"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1 uppercase">Brand *</label>
                  <input
                    type="text"
                    required
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Apex"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1 uppercase">Model</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="X200-128"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1 uppercase">Warranty (Months)</label>
                  <input
                    type="number"
                    value={warrantyPeriod}
                    onChange={(e) => setWarrantyPeriod(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Partner Tier Pricing Matrix */}
              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200 space-y-3">
                <span className="text-xs font-bold text-gray-800 block">Multi-Tier Partner Pricing (₹)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-600 font-medium">MRP *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={mrp}
                      onChange={(e) => setMrp(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded text-gray-900 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 font-medium">Supplier Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={supplierPrice}
                      onChange={(e) => setSupplierPrice(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded text-gray-900 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 font-medium">Distributor Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={distributorPrice}
                      onChange={(e) => setDistributorPrice(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded text-gray-900 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 font-medium">Dealer Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={dealerPrice}
                      onChange={(e) => setDealerPrice(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded text-gray-900 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 font-medium">Direct Dealer Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={directDealerPrice}
                      onChange={(e) => setDirectDealerPrice(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded text-gray-900 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 font-medium">Tax (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={tax}
                      onChange={(e) => setTax(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded text-gray-900 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <input
                  type="checkbox"
                  id="imeiToggle"
                  checked={imeiTracked}
                  onChange={(e) => setImeiTracked(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="imeiToggle" className="text-xs font-medium text-gray-800 cursor-pointer">
                  Requires IMEI-level Item Tracking
                </label>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1 uppercase">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed specs or description"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm"
                >
                  {submitting && <Icons.Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Product</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;
