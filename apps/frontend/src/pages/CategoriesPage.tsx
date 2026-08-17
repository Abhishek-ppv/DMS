import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/api';
import * as Icons from 'lucide-react';

export interface Category {
  id: string;
  name: string;
  description: string | null;
  parentCategoryId: string | null;
  parentCategory?: Category | null;
  subCategories?: Category[];
  status: string;
  createdAt: string;
}

interface CategoryTreeNodeProps {
  category: Category;
  allCategories: Category[];
  level: number;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onAddSubcategory: (parent: Category) => void;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
}

const CategoryTreeNode: React.FC<CategoryTreeNodeProps> = ({
  category,
  allCategories,
  level,
  canCreate,
  canUpdate,
  canDelete,
  onAddSubcategory,
  onEdit,
  onDelete,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Find direct children
  const children = allCategories.filter((c) => c.parentCategoryId === category.id);
  const hasChildren = children.length > 0;

  return (
    <div className="space-y-2">
      <div
        className={`p-3.5 bg-white rounded-lg border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-gray-300 transition shadow-sm ${
          level > 0 ? 'ml-5 sm:ml-7 border-l-4 border-l-blue-600' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          {hasChildren ? (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded transition"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <Icons.ChevronDown className="w-4 h-4" /> : <Icons.ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-5 shrink-0" />
          )}

          <div className="p-2 bg-blue-50 rounded-lg text-blue-600 border border-blue-100">
            {level === 0 ? <Icons.Folder className="w-4 h-4" /> : <Icons.FolderTree className="w-4 h-4" />}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-gray-900 text-sm">{category.name}</h4>
              {hasChildren && (
                <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200 font-semibold">
                  {children.length} {children.length === 1 ? 'subcategory' : 'subcategories'}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{category.description || 'No description'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
            {category.status}
          </span>

          {canCreate && (
            <button
              onClick={() => onAddSubcategory(category)}
              className="px-2.5 py-1 bg-white hover:bg-gray-50 text-blue-600 rounded-md text-xs font-semibold border border-gray-300 transition flex items-center gap-1 shadow-sm"
              title="Add Subcategory"
            >
              <Icons.Plus className="w-3.5 h-3.5" />
              <span>Subcategory</span>
            </button>
          )}

          {canUpdate && (
            <button
              onClick={() => onEdit(category)}
              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition"
              title="Edit Category"
            >
              <Icons.Edit2 className="w-4 h-4" />
            </button>
          )}

          {canDelete && (
            <button
              onClick={() => onDelete(category.id)}
              className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition"
              title="Delete Category"
            >
              <Icons.Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Render children if expanded */}
      {hasChildren && isExpanded && (
        <div className="space-y-2">
          {children.map((child) => (
            <CategoryTreeNode
              key={child.id}
              category={child}
              allCategories={allCategories}
              level={level + 1}
              canCreate={canCreate}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onAddSubcategory={onAddSubcategory}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const CategoriesPage: React.FC = () => {
  const { permissions } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canCreate = permissions.some((p) => p.resource === 'CATEGORY' && p.action === 'CREATE');
  const canUpdate = permissions.some((p) => p.resource === 'CATEGORY' && p.action === 'UPDATE');
  const canDelete = permissions.some((p) => p.resource === 'CATEGORY' && p.action === 'DELETE');

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Category[]>('/categories');
      setCategories(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openModal = (categoryToEdit?: Category, presetParentId?: string) => {
    if (categoryToEdit) {
      setEditingCategory(categoryToEdit);
      setName(categoryToEdit.name);
      setDescription(categoryToEdit.description || '');
      setParentCategoryId(categoryToEdit.parentCategoryId || '');
    } else {
      setEditingCategory(null);
      setName('');
      setDescription('');
      setParentCategoryId(presetParentId || '');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (editingCategory) {
        await api.patch(`/categories/${editingCategory.id}`, {
          name,
          description: description || undefined,
          parentCategoryId: parentCategoryId || null,
        });
      } else {
        await api.post('/categories', {
          name,
          description: description || undefined,
          parentCategoryId: parentCategoryId || undefined,
        });
      }

      setIsModalOpen(false);
      await fetchCategories();
    } catch (err: any) {
      setError(err.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    setError(null);
    try {
      await api.delete(`/categories/${id}`);
      await fetchCategories();
    } catch (err: any) {
      setError(err.message || 'Failed to delete category');
    }
  };

  // Top-level categories (parentCategoryId is null)
  const rootCategories = categories.filter((c) => !c.parentCategoryId);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
            <Icons.FolderTree className="w-6 h-6 text-blue-600" />
            Product Categories Hierarchy
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            Hierarchical category tree structure with subcategory classification
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCategories}
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
              <span>Add Category</span>
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

      {/* Category Tree Container */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Icons.GitBranch className="w-4 h-4 text-blue-600" />
            <span>Category Tree</span>
          </h2>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-md border border-gray-200">
            Total: {categories.length} Categories
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-500 text-xs flex flex-col items-center gap-2">
            <Icons.Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p>Loading category tree...</p>
          </div>
        ) : rootCategories.length === 0 ? (
          <div className="py-12 text-center text-gray-500 border border-dashed border-gray-200 rounded-lg text-xs">
            <Icons.FolderTree className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p>No categories found in database.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {rootCategories.map((rootCat) => (
              <CategoryTreeNode
                key={rootCat.id}
                category={rootCat}
                allCategories={categories}
                level={0}
                canCreate={canCreate}
                canUpdate={canUpdate}
                canDelete={canDelete}
                onAddSubcategory={(parent) => openModal(undefined, parent.id)}
                onEdit={(cat) => openModal(cat)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900">
                {editingCategory ? 'Edit Category' : parentCategoryId ? 'Add Subcategory' : 'Add New Category'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1 uppercase">Category Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Android or Flagship"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1 uppercase">Parent Category</label>
                <select
                  value={parentCategoryId}
                  onChange={(e) => setParentCategoryId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                >
                  <option value="">None (Root Category)</option>
                  {categories
                    .filter((c) => !editingCategory || c.id !== editingCategory.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1 uppercase">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief overview of category scope"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center gap-2 shadow-sm"
                >
                  {submitting && <Icons.Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Category</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesPage;
