import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  MessageSquare,
  AtSign,
  Search,
  Check,
  CheckCheck,
  Send,
  Filter,
  Inbox as InboxIcon,
  X,
  ChevronDown,
} from 'lucide-react';
import {
  fetchInbox,
  getUnreadCounts,
  markAsRead,
  markAllRead,
  replyToMessage,
  type InboxMessage,
  type UnreadCounts,
} from '../api/inbox';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type MessageTab = 'all' | 'comment' | 'dm' | 'mention';
type PlatformFilter = 'all' | 'twitter' | 'instagram' | 'facebook' | 'tiktok';

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#1da1f2',
  instagram: '#e4405f',
  facebook: '#1877f2',
  tiktok: '#000000',
};

const PLATFORM_LABELS: Record<string, string> = {
  all: 'All Platforms',
  twitter: 'Twitter',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

const TABS: { key: MessageTab; label: string; icon: React.ElementType; typeFilter?: string }[] = [
  { key: 'all', label: 'All', icon: Mail },
  { key: 'comment', label: 'Comments', icon: MessageSquare, typeFilter: 'comment' },
  { key: 'dm', label: 'DMs', icon: Mail, typeFilter: 'dm' },
  { key: 'mention', label: 'Mentions', icon: AtSign, typeFilter: 'mention' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function avatarInitial(name: string): string {
  return (name.charAt(0) || '?').toUpperCase();
}

function platformColorForAvatar(platform: string): string {
  return PLATFORM_COLORS[platform] ?? '#6b7280';
}

function getTabUnreadCount(unread: UnreadCounts | undefined, tab: MessageTab): number {
  if (!unread) return 0;
  if (tab === 'all') return unread.total;
  return unread.by_type[tab] ?? 0;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PlatformBadge({ platform }: { platform: string }) {
  const color = PLATFORM_COLORS[platform] ?? '#6b7280';
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide text-white"
      style={{ backgroundColor: color }}
    >
      {platform.slice(0, 2)}
    </span>
  );
}

function UnreadDot() {
  return <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />;
}

interface MessageItemProps {
  message: InboxMessage;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function MessageItem({ message, isSelected, onSelect }: MessageItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(message.id)}
      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-gray-100 last:border-b-0 ${
        isSelected
          ? 'bg-blue-50'
          : message.is_read
          ? 'bg-white hover:bg-gray-50'
          : 'bg-blue-50/40 hover:bg-blue-50/70'
      }`}
    >
      {/* Avatar */}
      {message.sender_avatar_url ? (
        <img
          src={message.sender_avatar_url}
          alt={message.sender_username}
          className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
        />
      ) : (
        <div
          className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: platformColorForAvatar(message.platform) }}
        >
          {avatarInitial(message.sender_username)}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-sm truncate ${message.is_read ? 'font-medium text-gray-700' : 'font-semibold text-gray-900'}`}>
            {message.sender_username}
          </span>
          <PlatformBadge platform={message.platform} />
          <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
            {relativeTime(message.received_at)}
          </span>
        </div>
        <p className={`text-sm truncate ${message.is_read ? 'text-gray-500' : 'text-gray-700'}`}>
          {message.content}
        </p>
        {message.sentiment && (
          <span
            className={`mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              message.sentiment === 'positive'
                ? 'bg-green-100 text-green-700'
                : message.sentiment === 'negative'
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {message.sentiment}
          </span>
        )}
      </div>

      {/* Unread indicator */}
      {!message.is_read && (
        <div className="flex-shrink-0 mt-1.5">
          <UnreadDot />
        </div>
      )}
    </button>
  );
}

interface MessageDetailProps {
  message: InboxMessage;
  onClose: () => void;
  onReply: (id: string, text: string) => void;
  isReplying: boolean;
}

function MessageDetail({ message, onClose, onReply, isReplying }: MessageDetailProps) {
  const [replyText, setReplyText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    onReply(message.id, replyText.trim());
    setReplyText('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          {message.sender_avatar_url ? (
            <img
              src={message.sender_avatar_url}
              alt={message.sender_username}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: platformColorForAvatar(message.platform) }}
            >
              {avatarInitial(message.sender_username)}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{message.sender_username}</span>
              <PlatformBadge platform={message.platform} />
            </div>
            <p className="text-xs text-gray-400">
              {new Date(message.received_at).toLocaleString()} &middot;{' '}
              <span className="capitalize">{message.message_type}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-6 py-5">
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{message.content}</p>
        {message.sentiment && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-gray-400">Sentiment:</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                message.sentiment === 'positive'
                  ? 'bg-green-100 text-green-700'
                  : message.sentiment === 'negative'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {message.sentiment}
            </span>
          </div>
        )}
        {message.is_replied && (
          <div className="mt-4 flex items-center gap-1.5 text-xs text-green-600">
            <CheckCheck size={14} />
            <span>Replied</span>
          </div>
        )}
      </div>

      {/* Reply box */}
      <form onSubmit={handleSubmit} className="px-6 py-4 border-t border-gray-200">
        <div className="flex items-end gap-2">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your reply..."
            rows={2}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!replyText.trim() || isReplying}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            {isReplying ? (
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Send size={14} />
            )}
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <InboxIcon size={48} strokeWidth={1.5} />
      <p className="mt-4 text-lg font-medium text-gray-500">Your inbox is empty</p>
      <p className="mt-1 text-sm text-gray-400">Messages, comments, and mentions will appear here.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Inbox() {
  const queryClient = useQueryClient();

  // Local UI state
  const [activeTab, setActiveTab] = useState<MessageTab>('all');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);

  // Query params derived from state
  const queryParams = {
    ...(activeTab !== 'all' && { message_type: activeTab }),
    ...(platformFilter !== 'all' && { platform: platformFilter }),
    ...(searchQuery.trim() && { search: searchQuery.trim() }),
  };

  // Data fetching
  const { data: inboxData, isLoading } = useQuery({
    queryKey: ['inbox', queryParams],
    queryFn: () => fetchInbox(queryParams),
  });

  const { data: unreadCounts } = useQuery({
    queryKey: ['inbox-unread-counts'],
    queryFn: getUnreadCounts,
    refetchInterval: 30_000,
  });

  // Mutations
  const markReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-unread-counts'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllRead(platformFilter !== 'all' ? platformFilter : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-unread-counts'] });
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => replyToMessage(id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });

  // Handlers
  const handleSelectMessage = useCallback(
    (id: string) => {
      setSelectedMessageId(id);
      const msg = inboxData?.items.find((m) => m.id === id);
      if (msg && !msg.is_read) {
        markReadMutation.mutate(id);
      }
    },
    [inboxData, markReadMutation],
  );

  const handleReply = useCallback(
    (messageId: string, text: string) => {
      replyMutation.mutate({ id: messageId, text });
    },
    [replyMutation],
  );

  const selectedMessage = inboxData?.items.find((m) => m.id === selectedMessageId) ?? null;
  const messages = inboxData?.items ?? [];

  return (
    <div className="h-[calc(100vh-4rem)]">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
          <p className="text-gray-500 mt-1">
            Manage all your messages, comments, and mentions in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => markAllReadMutation.mutate()}
          disabled={markAllReadMutation.isPending || !unreadCounts?.total}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <CheckCheck size={16} />
          Mark all read
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 mb-4">
        <div className="flex items-center gap-2 px-4 py-3 flex-wrap">
          {/* Tabs */}
          <div className="flex items-center gap-1 mr-2">
            {TABS.map((tab) => {
              const count = getTabUnreadCount(unreadCounts, tab.key);
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <TabIcon size={15} />
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={`ml-1 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 ${
                        isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Separator */}
          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Platform filter dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setPlatformDropdownOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
            >
              <Filter size={14} />
              {PLATFORM_LABELS[platformFilter]}
              <ChevronDown size={14} />
            </button>
            {platformDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setPlatformDropdownOpen(false)}
                />
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                  {(Object.keys(PLATFORM_LABELS) as PlatformFilter[]).map((pf) => (
                    <button
                      key={pf}
                      type="button"
                      onClick={() => {
                        setPlatformFilter(pf);
                        setPlatformDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                        platformFilter === pf ? 'text-blue-600 font-medium' : 'text-gray-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {pf !== 'all' && (
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ backgroundColor: PLATFORM_COLORS[pf] }}
                          />
                        )}
                        {PLATFORM_LABELS[pf]}
                      </span>
                      {platformFilter === pf && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] ml-auto">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content area: message list + detail pane */}
      <div className="bg-white rounded-xl border border-gray-200 flex overflow-hidden" style={{ height: 'calc(100% - 180px)' }}>
        {/* Message list */}
        <div
          className={`border-r border-gray-200 overflow-y-auto ${
            selectedMessage ? 'w-2/5' : 'w-full'
          } transition-all`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <span className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : messages.length === 0 ? (
            <EmptyState />
          ) : (
            messages.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                isSelected={msg.id === selectedMessageId}
                onSelect={handleSelectMessage}
              />
            ))
          )}
        </div>

        {/* Detail pane */}
        {selectedMessage && (
          <div className="flex-1 min-w-0">
            <MessageDetail
              message={selectedMessage}
              onClose={() => setSelectedMessageId(null)}
              onReply={handleReply}
              isReplying={replyMutation.isPending}
            />
          </div>
        )}
      </div>
    </div>
  );
}
