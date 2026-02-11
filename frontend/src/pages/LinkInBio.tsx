import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  GripVertical,
  ExternalLink,
  Eye,
  EyeOff,
  Link,
  Palette,
  Edit2,
  Save,
  X,
} from 'lucide-react';
import {
  listBioPages,
  createBioPage,
  updateBioPage,
  addBioLink,
  updateBioLink,
  deleteBioLink,
  getBioAnalytics,
} from '../api/linkInBio';
import type { BioPage, BioLink } from '../api/linkInBio';

// ── Theme presets ─────────────────────────────────────────────────────────
interface ThemePreset {
  key: string;
  label: string;
  bg: string;
  text: string;
  preview: string; // tailwind classes for the preview card
}

const THEME_PRESETS: ThemePreset[] = [
  {
    key: 'default',
    label: 'Default',
    bg: '#ffffff',
    text: '#111827',
    preview: 'bg-white border-gray-300',
  },
  {
    key: 'dark',
    label: 'Dark',
    bg: '#111827',
    text: '#f9fafb',
    preview: 'bg-gray-900 border-gray-700',
  },
  {
    key: 'ocean',
    label: 'Ocean',
    bg: '#1e3a5f',
    text: '#e0f2fe',
    preview: 'bg-gradient-to-b from-blue-800 to-cyan-700 border-blue-500',
  },
  {
    key: 'sunset',
    label: 'Sunset',
    bg: '#7c2d12',
    text: '#fef3c7',
    preview: 'bg-gradient-to-b from-orange-600 to-rose-500 border-orange-400',
  },
];

const BUTTON_STYLES = ['rounded', 'pill', 'square'] as const;

// ── Local draft state ─────────────────────────────────────────────────────
interface PageDraft {
  title: string;
  slug: string;
  bio: string;
  theme: string;
  bg_color: string;
  text_color: string;
  button_style: string;
}

function draftFromPage(page: BioPage): PageDraft {
  return {
    title: page.title,
    slug: page.slug,
    bio: page.bio ?? '',
    theme: page.theme,
    bg_color: page.bg_color,
    text_color: page.text_color,
    button_style: page.button_style,
  };
}

const EMPTY_DRAFT: PageDraft = {
  title: '',
  slug: '',
  bio: '',
  theme: 'default',
  bg_color: '#ffffff',
  text_color: '#111827',
  button_style: 'rounded',
};

// ── Inline link editor state ──────────────────────────────────────────────
interface LinkEditState {
  linkId: string | null;
  title: string;
  url: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function buttonRadiusClass(style: string): string {
  if (style === 'pill') return 'rounded-full';
  if (style === 'square') return 'rounded-none';
  return 'rounded-lg';
}

function previewBg(theme: string, bgColor: string): React.CSSProperties {
  const preset = THEME_PRESETS.find((t) => t.key === theme);
  if (theme === 'ocean') {
    return { background: 'linear-gradient(to bottom, #1e3a5f, #0e7490)' };
  }
  if (theme === 'sunset') {
    return { background: 'linear-gradient(to bottom, #ea580c, #e11d48)' };
  }
  return { backgroundColor: preset?.bg ?? bgColor };
}

// ── Color picker with hex input ───────────────────────────────────────────
function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-full border border-gray-300 flex-shrink-0"
        style={{ backgroundColor: value }}
      />
      <div className="flex-1">
        <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

// ── Phone mockup preview ──────────────────────────────────────────────────
function PhonePreview({
  draft,
  links,
}: {
  draft: PageDraft;
  links: BioLink[];
}) {
  const activeLinks = links.filter((l) => l.is_active);
  return (
    <div className="flex items-start justify-center">
      {/* phone frame */}
      <div className="relative w-[300px] h-[580px] rounded-[2.5rem] border-[6px] border-gray-800 bg-gray-800 shadow-xl overflow-hidden">
        {/* notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-gray-800 rounded-b-2xl z-10" />

        {/* screen */}
        <div
          className="w-full h-full overflow-y-auto pt-10 pb-6 px-5 flex flex-col items-center"
          style={{
            ...previewBg(draft.theme, draft.bg_color),
            color: draft.text_color,
          }}
        >
          {/* avatar */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold mb-3 border-2"
            style={{
              borderColor: draft.text_color,
              color: draft.text_color,
              opacity: 0.8,
            }}
          >
            {draft.title ? draft.title.charAt(0).toUpperCase() : '?'}
          </div>

          {/* title */}
          <h3 className="text-lg font-bold mb-1" style={{ color: draft.text_color }}>
            {draft.title || 'Your Name'}
          </h3>

          {/* bio */}
          {draft.bio && (
            <p
              className="text-sm text-center mb-5 max-w-[220px] opacity-80"
              style={{ color: draft.text_color }}
            >
              {draft.bio}
            </p>
          )}

          {/* link buttons */}
          <div className="w-full space-y-3">
            {activeLinks.length === 0 && (
              <p className="text-center text-sm opacity-50">No links yet</p>
            )}
            {activeLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`block w-full py-3 px-4 text-center text-sm font-medium border transition-opacity hover:opacity-80 ${buttonRadiusClass(
                  draft.button_style,
                )}`}
                style={{
                  borderColor: draft.text_color,
                  color: draft.text_color,
                }}
              >
                {link.title}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════

export default function LinkInBio() {
  const queryClient = useQueryClient();

  // ── Data fetching ────────────────────────────────────────────────────
  const {
    data: pages,
    isLoading: pagesLoading,
  } = useQuery({
    queryKey: ['bioPages'],
    queryFn: listBioPages,
  });

  // ── Selected page ────────────────────────────────────────────────────
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  const selectedPage = pages?.find((p) => p.id === selectedPageId) ?? null;

  // Auto-select the first page when data loads
  useEffect(() => {
    if (pages && pages.length > 0 && !selectedPageId) {
      setSelectedPageId(pages[0].id);
    }
  }, [pages, selectedPageId]);

  // ── Analytics for the selected page ──────────────────────────────────
  const { data: analyticsData } = useQuery({
    queryKey: ['bioAnalytics', selectedPageId],
    queryFn: () => getBioAnalytics(selectedPageId!),
    enabled: !!selectedPageId,
  });

  // ── Local draft state ────────────────────────────────────────────────
  const [draft, setDraft] = useState<PageDraft>(EMPTY_DRAFT);

  useEffect(() => {
    if (selectedPage) {
      setDraft(draftFromPage(selectedPage));
    } else {
      setDraft(EMPTY_DRAFT);
    }
  }, [selectedPage]);

  const updateDraft = useCallback(
    (patch: Partial<PageDraft>) => setDraft((prev) => ({ ...prev, ...patch })),
    [],
  );

  // ── Link inline editing ──────────────────────────────────────────────
  const [linkEdit, setLinkEdit] = useState<LinkEditState>({
    linkId: null,
    title: '',
    url: '',
  });

  const [addingLink, setAddingLink] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // ── Create-new-page dialog ───────────────────────────────────────────
  const [showNewPage, setShowNewPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageSlug, setNewPageSlug] = useState('');

  // ── Mutations ────────────────────────────────────────────────────────
  const invalidatePages = () => queryClient.invalidateQueries({ queryKey: ['bioPages'] });

  const createPageMutation = useMutation({
    mutationFn: createBioPage,
    onSuccess: (page) => {
      invalidatePages();
      setSelectedPageId(page.id);
      setShowNewPage(false);
      setNewPageTitle('');
      setNewPageSlug('');
    },
  });

  const updatePageMutation = useMutation({
    mutationFn: (data: Partial<BioPage>) => updateBioPage(selectedPageId!, data),
    onSuccess: invalidatePages,
  });

  const deletePageMutation = useMutation({
    mutationFn: () =>
      import('../api/linkInBio').then((mod) => mod.deleteBioPage(selectedPageId!)),
    onSuccess: () => {
      setSelectedPageId(null);
      invalidatePages();
    },
  });

  const addLinkMutation = useMutation({
    mutationFn: (data: { title: string; url: string }) => addBioLink(selectedPageId!, data),
    onSuccess: () => {
      invalidatePages();
      setAddingLink(false);
      setNewLinkTitle('');
      setNewLinkUrl('');
    },
  });

  const updateLinkMutation = useMutation({
    mutationFn: ({ linkId, data }: { linkId: string; data: Partial<BioLink> }) =>
      updateBioLink(selectedPageId!, linkId, data),
    onSuccess: () => {
      invalidatePages();
      setLinkEdit({ linkId: null, title: '', url: '' });
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: (linkId: string) => deleteBioLink(selectedPageId!, linkId),
    onSuccess: invalidatePages,
  });

  // ── Debounced auto-save for page settings ────────────────────────────
  useEffect(() => {
    if (!selectedPageId || !selectedPage) return;
    const existing = draftFromPage(selectedPage);
    const changed = (Object.keys(draft) as (keyof PageDraft)[]).some(
      (k) => draft[k] !== existing[k],
    );
    if (!changed) return;

    const timer = setTimeout(() => {
      updatePageMutation.mutate(draft);
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, selectedPageId]);

  // ── Toggle published/draft ───────────────────────────────────────────
  const handleTogglePublished = () => {
    if (!selectedPage) return;
    updatePageMutation.mutate({ is_published: !selectedPage.is_published });
  };

  // ── Apply theme preset ───────────────────────────────────────────────
  const applyTheme = (preset: ThemePreset) => {
    updateDraft({
      theme: preset.key,
      bg_color: preset.bg,
      text_color: preset.text,
    });
  };

  // ── Links list (local from selected page) ────────────────────────────
  const links: BioLink[] = selectedPage?.links ?? [];

  // ══════════════════════════════════════════════════════════════════════
  // Empty state
  // ══════════════════════════════════════════════════════════════════════
  if (!pagesLoading && (!pages || pages.length === 0) && !showNewPage) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24">
        <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Link size={36} className="text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Link in Bio</h1>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          Create a beautiful landing page with all your important links. Share a
          single URL across all your social profiles.
        </p>
        <button
          onClick={() => setShowNewPage(true)}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Create Your First Bio Page
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // New-page modal
  // ══════════════════════════════════════════════════════════════════════
  const newPageModal = showNewPage && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 mx-4">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Create New Bio Page</h2>

        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
        <input
          value={newPageTitle}
          onChange={(e) => setNewPageTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="My Link Page"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
        <input
          value={newPageSlug}
          onChange={(e) =>
            setNewPageSlug(
              e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, '-')
                .replace(/-+/g, '-'),
            )
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="my-page"
        />
        <p className="text-xs text-gray-400 mb-4">
          yourapp.com/p/{newPageSlug || 'your-slug'}
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => {
              setShowNewPage(false);
              setNewPageTitle('');
              setNewPageSlug('');
            }}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              createPageMutation.mutate({
                title: newPageTitle,
                slug: newPageSlug,
              })
            }
            disabled={!newPageTitle.trim() || !newPageSlug.trim() || createPageMutation.isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {createPageMutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════
  // Main layout
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto">
      {newPageModal}

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Link in Bio</h1>

          {pages && pages.length > 1 && (
            <select
              value={selectedPageId ?? ''}
              onChange={(e) => setSelectedPageId(e.target.value)}
              className="ml-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || p.slug}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-3">
          {selectedPage && (
            <>
              {/* Published / Draft toggle */}
              <button
                onClick={handleTogglePublished}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  selectedPage.is_published
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200'
                }`}
              >
                {selectedPage.is_published ? <Eye size={16} /> : <EyeOff size={16} />}
                {selectedPage.is_published ? 'Published' : 'Draft'}
              </button>

              {/* Delete page */}
              <button
                onClick={() => {
                  if (window.confirm('Delete this bio page? This cannot be undone.')) {
                    deletePageMutation.mutate();
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </>
          )}

          <button
            onClick={() => setShowNewPage(true)}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            New Page
          </button>
        </div>
      </div>

      {/* ── Two-column editor + preview ──────────────────────────────── */}
      {selectedPage && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT PANEL — Editor (3 cols) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Page settings */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Edit2 size={16} className="text-gray-500" />
                Page Settings
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                  <input
                    value={draft.title}
                    onChange={(e) => updateDraft({ title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your Name / Brand"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Slug</label>
                  <input
                    value={draft.slug}
                    onChange={(e) =>
                      updateDraft({
                        slug: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, '-')
                          .replace(/-+/g, '-'),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="my-page"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    yourapp.com/p/{draft.slug || 'your-slug'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Bio</label>
                  <textarea
                    value={draft.bio}
                    onChange={(e) => updateDraft({ bio: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="A short description about you..."
                  />
                </div>
              </div>
            </div>

            {/* Theme selector */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Palette size={16} className="text-gray-500" />
                Theme
              </h2>

              <div className="grid grid-cols-4 gap-3 mb-5">
                {THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => applyTheme(preset)}
                    className={`relative h-20 rounded-xl border-2 transition-all ${
                      preset.preview
                    } ${
                      draft.theme === preset.key
                        ? 'ring-2 ring-blue-500 ring-offset-2'
                        : 'hover:ring-1 hover:ring-gray-300'
                    }`}
                  >
                    <span
                      className="absolute bottom-1.5 left-0 right-0 text-[10px] font-medium text-center"
                      style={{ color: preset.text }}
                    >
                      {preset.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Button style */}
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Button Style
              </label>
              <div className="flex gap-3 mb-5">
                {BUTTON_STYLES.map((style) => (
                  <label
                    key={style}
                    className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg cursor-pointer transition-colors ${
                      draft.button_style === style
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="button_style"
                      value={style}
                      checked={draft.button_style === style}
                      onChange={() => updateDraft({ button_style: style })}
                      className="sr-only"
                    />
                    <span className="capitalize">{style}</span>
                  </label>
                ))}
              </div>

              {/* Custom colors */}
              <div className="grid grid-cols-2 gap-4">
                <ColorInput
                  label="Background"
                  value={draft.bg_color}
                  onChange={(v) => updateDraft({ bg_color: v })}
                />
                <ColorInput
                  label="Text"
                  value={draft.text_color}
                  onChange={(v) => updateDraft({ text_color: v })}
                />
              </div>
            </div>

            {/* Links list */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Link size={16} className="text-gray-500" />
                Links
              </h2>

              {links.length === 0 && !addingLink && (
                <p className="text-sm text-gray-400 text-center py-4">
                  No links yet. Add your first link below.
                </p>
              )}

              <div className="space-y-3">
                {links.map((link) => {
                  const isEditing = linkEdit.linkId === link.id;

                  if (isEditing) {
                    return (
                      <div
                        key={link.id}
                        className="border border-blue-200 bg-blue-50 rounded-lg p-4"
                      >
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Title
                            </label>
                            <input
                              value={linkEdit.title}
                              onChange={(e) =>
                                setLinkEdit((prev) => ({ ...prev, title: e.target.value }))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              URL
                            </label>
                            <input
                              value={linkEdit.url}
                              onChange={(e) =>
                                setLinkEdit((prev) => ({ ...prev, url: e.target.value }))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="https://..."
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() =>
                                setLinkEdit({ linkId: null, title: '', url: '' })
                              }
                              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                              <X size={14} className="inline mr-1" />
                              Cancel
                            </button>
                            <button
                              onClick={() =>
                                updateLinkMutation.mutate({
                                  linkId: link.id,
                                  data: { title: linkEdit.title, url: linkEdit.url },
                                })
                              }
                              disabled={!linkEdit.title.trim() || !linkEdit.url.trim()}
                              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                              <Save size={14} className="inline mr-1" />
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={link.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group"
                    >
                      {/* Drag handle */}
                      <div className="cursor-grab text-gray-300 hover:text-gray-500">
                        <GripVertical size={18} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {link.title}
                        </p>
                        <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                          <ExternalLink size={10} />
                          {link.url}
                        </p>
                      </div>

                      {/* Click count badge */}
                      <span className="flex-shrink-0 text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">
                        {link.click_count} clicks
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() =>
                            setLinkEdit({
                              linkId: link.id,
                              title: link.title,
                              url: link.url,
                            })
                          }
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                          title="Edit link"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Delete this link?')) {
                              deleteLinkMutation.mutate(link.id);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                          title="Delete link"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add link inline form */}
              {addingLink && (
                <div className="mt-3 border border-dashed border-gray-300 rounded-lg p-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Title
                      </label>
                      <input
                        value={newLinkTitle}
                        onChange={(e) => setNewLinkTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="My Website"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        URL
                      </label>
                      <input
                        value={newLinkUrl}
                        onChange={(e) => setNewLinkUrl(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://example.com"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setAddingLink(false);
                          setNewLinkTitle('');
                          setNewLinkUrl('');
                        }}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() =>
                          addLinkMutation.mutate({
                            title: newLinkTitle,
                            url: newLinkUrl,
                          })
                        }
                        disabled={
                          !newLinkTitle.trim() || !newLinkUrl.trim() || addLinkMutation.isPending
                        }
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {addLinkMutation.isPending ? 'Adding...' : 'Add Link'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Add link button */}
              {!addingLink && (
                <button
                  onClick={() => setAddingLink(true)}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors text-sm"
                >
                  <Plus size={18} />
                  Add Link
                </button>
              )}
            </div>
          </div>

          {/* RIGHT PANEL — Live preview (2 cols) */}
          <div className="lg:col-span-2">
            <div className="sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Live Preview</h2>
                {selectedPage.is_published && (
                  <a
                    href={`/p/${selectedPage.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink size={12} />
                    Open page
                  </a>
                )}
              </div>

              <PhonePreview draft={draft} links={links} />

              {/* Quick analytics */}
              {analyticsData && (
                <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">Page Analytics</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total Views</span>
                    <span className="font-semibold text-gray-900">
                      {selectedPage.total_views}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-600">Total Clicks</span>
                    <span className="font-semibold text-gray-900">
                      {links.reduce((sum, l) => sum + l.click_count, 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
