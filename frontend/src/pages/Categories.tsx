import { useState, useCallback } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Tag,
  Plus,
  Trash2,
  Edit2,
  Recycle,
  Clock,
  RefreshCw,
  FolderOpen,
  Save,
  X,
} from 'lucide-react';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getRecyclablePosts,
  getRecycleQueue,
  addToRecycleQueue,
} from '../api/categories';
import type { ContentCategory } from '../api/categories';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CategoryFormData {
  name: string;
  description: string;
  color: string;
  is_recyclable: boolean;
  recycle_interval_days: number;
}

interface RecyclablePost {
  id: string;
  caption: string;
  category_id: string;
  category_name: string;
  last_published_at: string;
  eligible_since: string;
}

interface RecycleQueueItem {
  id: string;
  post_id: string;
  caption: string;
  category_name: string;
  scheduled_for: string;
}

type ActiveTab = 'categories' | 'recycling';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COLOR_PALETTE = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

const EMPTY_FORM: CategoryFormData = {
  name: '',
  description: '',
  color: COLOR_PALETTE[0],
  is_recyclable: false,
  recycle_interval_days: 30,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '...' : str;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Categories() {
  const queryClient = useQueryClient();

  /* ---- UI state ---- */
  const [activeTab, setActiveTab] = useState<ActiveTab>('categories');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(EMPTY_FORM);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [recyclePostId, setRecyclePostId] = useState<string | null>(null);
  const [recycleCategoryId, setRecycleCategoryId] = useState<string | null>(null);
  const [recycleDateTime, setRecycleDateTime] = useState('');

  /* ---- queries ---- */

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
  });

  const { data: recyclableData, isLoading: recyclableLoading } = useQuery({
    queryKey: ['recyclable-posts'],
    queryFn: getRecyclablePosts,
    enabled: activeTab === 'recycling',
  });

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['recycle-queue'],
    queryFn: getRecycleQueue,
    enabled: activeTab === 'recycling',
  });

  const categories: ContentCategory[] = categoriesData?.items ?? [];
  const recyclablePosts: RecyclablePost[] = (recyclableData as { items?: RecyclablePost[] })?.items ?? (recyclableData as RecyclablePost[]) ?? [];
  const recycleQueue: RecycleQueueItem[] = (queueData as { items?: RecycleQueueItem[] })?.items ?? (queueData as RecycleQueueItem[]) ?? [];

  /* ---- mutations ---- */

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ContentCategory> }) =>
      updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (expandedCategoryId) setExpandedCategoryId(null);
    },
  });

  const addToQueueMutation = useMutation({
    mutationFn: addToRecycleQueue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recycle-queue'] });
      queryClient.invalidateQueries({ queryKey: ['recyclable-posts'] });
      setRecyclePostId(null);
      setRecycleCategoryId(null);
      setRecycleDateTime('');
    },
  });

  /* ---- form helpers ---- */

  const resetForm = useCallback(() => {
    setShowCreateForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  }, []);

  const startEdit = useCallback((cat: ContentCategory) => {
    setEditingId(cat.id);
    setShowCreateForm(true);
    setFormData({
      name: cat.name,
      description: cat.description ?? '',
      color: cat.color,
      is_recyclable: cat.is_recyclable,
      recycle_interval_days: cat.recycle_interval_days,
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!formData.name.trim()) return;

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        data: {
          name: formData.name,
          description: formData.description || null,
          color: formData.color,
          is_recyclable: formData.is_recyclable,
          recycle_interval_days: formData.is_recyclable
            ? formData.recycle_interval_days
            : 0,
        },
      });
    } else {
      createMutation.mutate({
        name: formData.name,
        description: formData.description || undefined,
        color: formData.color,
        is_recyclable: formData.is_recyclable,
        recycle_interval_days: formData.is_recyclable
          ? formData.recycle_interval_days
          : undefined,
      });
    }
  }, [formData, editingId, createMutation, updateMutation]);

  const handleAddToQueue = useCallback(
    (postId: string, categoryId: string) => {
      if (!recycleDateTime) return;
      addToQueueMutation.mutate({
        post_id: postId,
        category_id: categoryId,
        scheduled_for: new Date(recycleDateTime).toISOString(),
      });
    },
    [recycleDateTime, addToQueueMutation],
  );

  /* ================================================================ */
  /*  Category Form (inline card)                                      */
  /* ================================================================ */

  const renderCategoryForm = () => (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          {editingId ? 'Edit Category' : 'Create Category'}
        </h3>
        <button
          type="button"
          onClick={resetForm}
          className="text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="cat-name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id="cat-name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Tips & Tricks"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="cat-desc" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="cat-desc"
            rows={2}
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Optional description..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
          />
        </div>

        {/* Color picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
          <div className="flex items-center gap-2">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, color: c }))}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  formData.color === c
                    ? 'border-gray-900 scale-110'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
        </div>

        {/* Recyclable toggle */}
        <div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={formData.is_recyclable}
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  is_recyclable: !prev.is_recyclable,
                }))
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.is_recyclable ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  formData.is_recyclable ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm font-medium text-gray-700">Recyclable content</span>
          </div>

          {formData.is_recyclable && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-gray-600">Recycle every</span>
              <input
                type="number"
                min={1}
                max={365}
                value={formData.recycle_interval_days}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    recycle_interval_days: Math.max(1, parseInt(e.target.value) || 1),
                  }))
                }
                className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <span className="text-sm text-gray-600">days</span>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={
              !formData.name.trim() ||
              createMutation.isPending ||
              updateMutation.isPending
            }
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save size={16} />
            {editingId ? 'Update' : 'Save'}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  /* ================================================================ */
  /*  Category card                                                    */
  /* ================================================================ */

  const renderCategoryCard = (cat: ContentCategory) => {
    const isExpanded = expandedCategoryId === cat.id;

    return (
      <div key={cat.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div
          className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() =>
            setExpandedCategoryId(isExpanded ? null : cat.id)
          }
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 truncate">{cat.name}</h3>
                {cat.description && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{cat.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(cat);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Edit category"
              >
                <Edit2 size={14} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMutation.mutate(cat.id);
                }}
                disabled={deleteMutation.isPending}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                aria-label="Delete category"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Metadata badges */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {cat.post_count} post{cat.post_count !== 1 ? 's' : ''}
            </span>
            {cat.is_recyclable && (
              <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <Recycle size={10} />
                Recyclable ({cat.recycle_interval_days}d)
              </span>
            )}
          </div>
        </div>

        {/* Expanded section -- placeholder for category posts */}
        {isExpanded && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Posts in this category
            </p>
            {cat.post_count > 0 ? (
              <p className="text-sm text-gray-600">
                {cat.post_count} post{cat.post_count !== 1 ? 's' : ''} in this category.
                View them in the content calendar.
              </p>
            ) : (
              <div className="text-center py-6">
                <FolderOpen size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No posts in this category yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  /* ================================================================ */
  /*  Categories tab                                                   */
  /* ================================================================ */

  const renderCategoriesTab = () => (
    <div>
      {/* Create button */}
      {!showCreateForm && (
        <button
          type="button"
          onClick={() => {
            setShowCreateForm(true);
            setEditingId(null);
            setFormData(EMPTY_FORM);
          }}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Create Category
        </button>
      )}

      {/* Inline form */}
      {showCreateForm && renderCategoryForm()}

      {/* Category grid */}
      {categoriesLoading ? (
        <div className="text-center py-12">
          <RefreshCw size={28} className="mx-auto text-blue-500 animate-spin" />
          <p className="mt-3 text-sm text-gray-500">Loading categories...</p>
        </div>
      ) : categories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(renderCategoryCard)}
        </div>
      ) : (
        <div className="text-center py-16">
          <Tag size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No categories yet. Create one to get started.</p>
        </div>
      )}
    </div>
  );

  /* ================================================================ */
  /*  Recycling tab                                                    */
  /* ================================================================ */

  const renderRecyclingTab = () => (
    <div className="space-y-8">
      {/* Ready to recycle */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Recycle size={18} className="text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">Ready to Recycle</h3>
        </div>

        {recyclableLoading ? (
          <div className="text-center py-8">
            <RefreshCw size={24} className="mx-auto text-blue-500 animate-spin" />
          </div>
        ) : recyclablePosts.length > 0 ? (
          <div className="space-y-3">
            {recyclablePosts.map((post) => (
              <div
                key={post.id}
                className="bg-white border border-gray-200 rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 line-clamp-2">{post.caption}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-gray-500">
                        Category: {post.category_name}
                      </span>
                      <span className="text-xs text-gray-500">
                        Last published: {formatDate(post.last_published_at)}
                      </span>
                      <span className="text-xs text-green-600 font-medium">
                        Eligible since {formatDate(post.eligible_since)}
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {recyclePostId === post.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="datetime-local"
                          value={recycleDateTime}
                          onChange={(e) => setRecycleDateTime(e.target.value)}
                          className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleAddToQueue(post.id, post.category_id)
                          }
                          disabled={
                            !recycleDateTime || addToQueueMutation.isPending
                          }
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRecyclePostId(null);
                            setRecycleDateTime('');
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-600"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setRecyclePostId(post.id);
                          setRecycleCategoryId(post.category_id);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
                      >
                        <Clock size={12} />
                        Add to Queue
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-white border border-gray-200 rounded-xl">
            <Recycle size={36} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">
              No posts ready to recycle yet.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Posts become recyclable after their configured interval has passed.
            </p>
          </div>
        )}
      </div>

      {/* Recycle queue */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Recycle Queue</h3>
        </div>

        {queueLoading ? (
          <div className="text-center py-8">
            <RefreshCw size={24} className="mx-auto text-blue-500 animate-spin" />
          </div>
        ) : recycleQueue.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Post</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Scheduled For
                  </th>
                </tr>
              </thead>
              <tbody>
                {recycleQueue.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-gray-900 max-w-sm">
                      <span title={item.caption}>{truncate(item.caption, 50)}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.category_name}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {formatDateTime(item.scheduled_for)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 bg-white border border-gray-200 rounded-xl">
            <Clock size={36} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">
              Recycle queue is empty.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Add recyclable posts to the queue from the list above.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Categories</h1>
          <p className="text-gray-500 mt-1">
            Organise posts by category and recycle evergreen content.
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'categories'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Tag size={16} />
          Categories
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('recycling')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'recycling'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Recycle size={16} />
          Recycling
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'categories' && renderCategoriesTab()}
      {activeTab === 'recycling' && renderRecyclingTab()}
    </div>
  );
}
