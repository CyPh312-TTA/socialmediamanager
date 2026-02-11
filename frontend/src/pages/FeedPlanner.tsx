import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Image,
  GripVertical,
  Eye,
  Calendar,
  Instagram,
  RefreshCw,
} from 'lucide-react';
import { getFeedPreview, reorderFeedPosts } from '../api/feedPlanner';
import type { FeedGridItem, FeedGridResponse } from '../api/feedPlanner';
import { listAccounts } from '../api/accounts';
import type { SocialAccount } from '../types';

// ── Side-panel detail view ────────────────────────────────────────────────
interface PostDetailPanelProps {
  item: FeedGridItem;
  onClose: () => void;
}

function PostDetailPanel({ item, onClose }: PostDetailPanelProps) {
  const isScheduled = item.status === 'scheduled';

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Post Details</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Thumbnail */}
        <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
          {item.thumbnail_url ? (
            <img
              src={item.thumbnail_url}
              alt="Post thumbnail"
              className="w-full h-full object-cover"
            />
          ) : (
            <Image size={48} className="text-gray-300" />
          )}
        </div>

        {/* Caption */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Caption</label>
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {item.caption_preview || 'No caption'}
          </p>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
              isScheduled
                ? 'bg-blue-50 text-blue-700'
                : item.status === 'published'
                ? 'bg-green-50 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {isScheduled ? <Clock size={12} /> : <Eye size={12} />}
            <span className="capitalize">{item.status}</span>
          </span>
        </div>

        {/* Scheduled time */}
        {item.scheduled_time && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {isScheduled ? 'Scheduled For' : 'Published At'}
            </label>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Calendar size={14} className="text-gray-400" />
              {new Date(item.scheduled_time).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </div>
          </div>
        )}

        {/* Grid position */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Grid Position</label>
          <p className="text-sm text-gray-700">
            Row {item.row + 1}, Column {item.col + 1}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Single grid cell ──────────────────────────────────────────────────────
interface GridCellProps {
  item: FeedGridItem;
  onClick: () => void;
}

function GridCell({ item, onClick }: GridCellProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const isScheduled = item.status === 'scheduled';

  return (
    <div
      className="relative group"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        onClick={onClick}
        className={`relative w-full aspect-square overflow-hidden bg-gray-100 flex items-center justify-center transition-all ${
          isScheduled
            ? 'border-2 border-dashed border-blue-300'
            : 'border border-solid border-gray-200'
        } hover:opacity-90`}
      >
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt={item.caption_preview || 'Post'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
            <Image size={28} className="text-gray-400" />
          </div>
        )}

        {/* Scheduled overlay */}
        {isScheduled && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow">
            <Clock size={13} className="text-white" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <Eye
            size={22}
            className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md"
          />
        </div>
      </button>

      {/* Caption tooltip */}
      {showTooltip && item.caption_preview && (
        <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none">
          <p className="line-clamp-3">{item.caption_preview}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

// ── Reorder controls ──────────────────────────────────────────────────────
interface ReorderBarProps {
  items: FeedGridItem[];
  onReorder: (postIds: string[]) => void;
  isPending: boolean;
}

function ReorderBar({ items, onReorder, isPending }: ReorderBarProps) {
  const scheduledItems = items.filter((i) => i.status === 'scheduled');

  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [showReorder, setShowReorder] = useState(false);

  const startReorder = useCallback(() => {
    setLocalOrder(scheduledItems.map((i) => i.post_id));
    setShowReorder(true);
  }, [scheduledItems]);

  if (scheduledItems.length < 2) return null;

  if (!showReorder) {
    return (
      <button
        onClick={startReorder}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
      >
        <GripVertical size={14} />
        Reorder Scheduled
      </button>
    );
  }

  const titleForId = (id: string) => {
    const found = scheduledItems.find((i) => i.post_id === id);
    return found?.caption_preview?.slice(0, 40) || id.slice(0, 8);
  };

  const moveItem = (from: number, to: number) => {
    const next = [...localOrder];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    setLocalOrder(next);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Reorder Scheduled Posts
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowReorder(false)}
            className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onReorder(localOrder);
              setShowReorder(false);
            }}
            disabled={isPending}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Save Order'}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {localOrder.map((id, idx) => (
          <div
            key={id}
            draggable
            onDragStart={() => setDraggingIdx(idx)}
            onDragOver={(e) => {
              e.preventDefault();
              if (draggingIdx !== null && draggingIdx !== idx) {
                moveItem(draggingIdx, idx);
                setDraggingIdx(idx);
              }
            }}
            onDragEnd={() => setDraggingIdx(null)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm cursor-grab active:cursor-grabbing ${
              draggingIdx === idx
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <GripVertical size={14} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-400 w-5">{idx + 1}</span>
            <span className="text-gray-700 truncate flex-1">{titleForId(id)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════

export default function FeedPlanner() {
  const queryClient = useQueryClient();

  // ── Accounts (Instagram only) ────────────────────────────────────────
  const { data: allAccounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: listAccounts,
  });

  const instagramAccounts = useMemo(
    () => (allAccounts ?? []).filter((a: SocialAccount) => a.platform === 'instagram'),
    [allAccounts],
  );

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Auto-select first IG account
  const accountId =
    selectedAccountId ??
    (instagramAccounts.length > 0 ? instagramAccounts[0].id : null);

  // ── Feed data ────────────────────────────────────────────────────────
  const {
    data: feedData,
    isLoading: feedLoading,
    refetch: refetchFeed,
  } = useQuery<FeedGridResponse>({
    queryKey: ['feedPreview', accountId],
    queryFn: () => getFeedPreview(accountId!, 30),
    enabled: !!accountId,
  });

  // ── Reorder mutation ─────────────────────────────────────────────────
  const reorderMutation = useMutation({
    mutationFn: (postIds: string[]) => reorderFeedPosts(accountId!, postIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedPreview', accountId] });
    },
  });

  // ── Side panel ───────────────────────────────────────────────────────
  const [selectedPost, setSelectedPost] = useState<FeedGridItem | null>(null);

  // ── Grid items sorted by position ────────────────────────────────────
  const gridItems = useMemo(() => {
    if (!feedData?.items) return [];
    return [...feedData.items].sort((a, b) => a.grid_position - b.grid_position);
  }, [feedData]);

  // ── Build rows for 3-col grid ────────────────────────────────────────
  const gridRows = useMemo(() => {
    const rows: FeedGridItem[][] = [];
    for (let i = 0; i < gridItems.length; i += 3) {
      rows.push(gridItems.slice(i, i + 3));
    }
    return rows;
  }, [gridItems]);

  // ══════════════════════════════════════════════════════════════════════
  // No Instagram accounts
  // ══════════════════════════════════════════════════════════════════════
  if (!allAccounts) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center">
        <RefreshCw size={32} className="mx-auto text-gray-300 animate-spin mb-4" />
        <p className="text-gray-500 text-sm">Loading accounts...</p>
      </div>
    );
  }

  if (instagramAccounts.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24">
        <div className="w-20 h-20 bg-pink-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Instagram size={36} className="text-pink-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Visual Feed Planner</h1>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          Connect an Instagram account to preview and plan your feed layout. Drag
          and drop to reorder scheduled posts for a cohesive grid.
        </p>
        <a
          href="/accounts"
          className="inline-flex items-center gap-2 px-6 py-3 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition-colors"
        >
          <Instagram size={20} />
          Connect Instagram
        </a>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // Main layout
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-4xl mx-auto">
      {/* Side panel overlay */}
      {selectedPost && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-30"
            onClick={() => setSelectedPost(null)}
          />
          <PostDetailPanel
            item={selectedPost}
            onClose={() => setSelectedPost(null)}
          />
        </>
      )}

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feed Planner</h1>
          <p className="text-gray-500 text-sm mt-1">
            Preview and plan your Instagram grid layout.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Account selector */}
          {instagramAccounts.length > 1 ? (
            <select
              value={accountId ?? ''}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              {instagramAccounts.map((acc: SocialAccount) => (
                <option key={acc.id} value={acc.id}>
                  @{acc.platform_username}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-gray-600 flex items-center gap-1.5">
              <Instagram size={16} className="text-pink-500" />
              @{instagramAccounts[0]?.platform_username}
            </span>
          )}

          {/* Refresh */}
          <button
            onClick={() => refetchFeed()}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh feed"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* ── Stats bar ────────────────────────────────────────────────── */}
      {feedData && (
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-6 bg-white border border-gray-200 rounded-xl px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
              <span className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">
                  {feedData.total_published}
                </span>{' '}
                Published
              </span>
            </div>
            <div className="w-px h-5 bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
              <span className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">
                  {feedData.total_scheduled}
                </span>{' '}
                Scheduled
              </span>
            </div>
          </div>

          <a
            href="/analytics"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <Calendar size={14} />
            Analyze Best Times
          </a>
        </div>
      )}

      {/* ── Reorder bar ──────────────────────────────────────────────── */}
      {feedData && (
        <div className="mb-6">
          <ReorderBar
            items={gridItems}
            onReorder={(ids) => reorderMutation.mutate(ids)}
            isPending={reorderMutation.isPending}
          />
        </div>
      )}

      {/* ── Grid ─────────────────────────────────────────────────────── */}
      {feedLoading && (
        <div className="py-24 text-center">
          <RefreshCw size={32} className="mx-auto text-gray-300 animate-spin mb-4" />
          <p className="text-gray-500 text-sm">Loading feed preview...</p>
        </div>
      )}

      {!feedLoading && gridItems.length === 0 && (
        <div className="text-center py-24">
          <Image size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 mb-1 font-medium">No posts yet</p>
          <p className="text-sm text-gray-400">
            Create and schedule posts to see your feed preview.
          </p>
        </div>
      )}

      {!feedLoading && gridItems.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Instagram-style header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center">
              <Instagram size={16} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-900">
              @{instagramAccounts.find((a: SocialAccount) => a.id === accountId)?.platform_username ?? 'account'}
            </span>
          </div>

          {/* 3-column grid */}
          <div className="grid grid-cols-3 gap-px bg-gray-200">
            {gridRows.map((row, rowIdx) =>
              row.map((item, colIdx) => (
                <GridCell
                  key={item.post_id}
                  item={item}
                  onClick={() => setSelectedPost(item)}
                />
              )),
            )}

            {/* Pad the last row if needed */}
            {gridRows.length > 0 &&
              gridRows[gridRows.length - 1].length < 3 &&
              Array.from({
                length: 3 - gridRows[gridRows.length - 1].length,
              }).map((_, i) => (
                <div
                  key={`pad-${i}`}
                  className="aspect-square bg-gray-50"
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
