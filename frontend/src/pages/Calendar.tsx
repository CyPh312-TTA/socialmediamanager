import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  X,
  Ban,
} from 'lucide-react';
import { listPosts, cancelPost } from '../api/posts';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
  parseISO,
} from 'date-fns';
import { toast } from '../components/Toast';
import { useNavigate } from 'react-router-dom';
import type { Post } from '../types';

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  published: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  draft: 'bg-gray-100 text-gray-500 border-gray-200',
  publishing: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function PostPill({ post, onClick }: { post: Post; onClick: () => void }) {
  const style = STATUS_STYLES[post.status] || STATUS_STYLES.draft;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`w-full text-left text-xs px-1.5 py-0.5 rounded border truncate ${style} hover:opacity-80 transition-opacity`}
      title={`${post.status}: ${post.caption}`}
    >
      {post.platforms.map((p) => p.platform.charAt(0).toUpperCase()).join('')}{' '}
      {post.caption.slice(0, 30)}
    </button>
  );
}

function PostDetailModal({
  post,
  onClose,
  onCancel,
}: {
  post: Post;
  onClose: () => void;
  onCancel: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Post Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <span
              className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                STATUS_STYLES[post.status] || ''
              }`}
            >
              {post.status}
            </span>
          </div>

          <p className="text-sm text-gray-700 whitespace-pre-wrap">{post.caption}</p>

          {post.hashtags && post.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {post.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {post.platforms.map((pp) => (
              <span
                key={pp.id}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded capitalize"
              >
                {pp.platform} ({pp.status})
              </span>
            ))}
          </div>

          {post.scheduled_time && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Clock size={12} />
              Scheduled: {format(parseISO(post.scheduled_time), 'MMM d, yyyy h:mm a')}
            </p>
          )}

          <p className="text-xs text-gray-400">
            Created: {format(parseISO(post.created_at), 'MMM d, yyyy h:mm a')}
          </p>
        </div>

        {post.status === 'scheduled' && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <button
              onClick={() => onCancel(post.id)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
            >
              <Ban size={16} />
              Cancel Schedule
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: scheduledData } = useQuery({
    queryKey: ['posts', 'scheduled'],
    queryFn: () => listPosts('scheduled', 0, 200),
  });

  const { data: publishedData } = useQuery({
    queryKey: ['posts', 'published'],
    queryFn: () => listPosts('published', 0, 200),
  });

  const { data: draftData } = useQuery({
    queryKey: ['posts', 'draft'],
    queryFn: () => listPosts('draft', 0, 200),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Post schedule cancelled');
      setSelectedPost(null);
    },
    onError: () => {
      toast.error('Failed to cancel post');
    },
  });

  const allPosts = useMemo(() => {
    return [
      ...(scheduledData?.items || []),
      ...(publishedData?.items || []),
      ...(draftData?.items || []),
    ];
  }, [scheduledData, publishedData, draftData]);

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  // Group posts by date
  const postsByDate = useMemo(() => {
    const map: Record<string, Post[]> = {};
    for (const post of allPosts) {
      // Use scheduled_time for scheduled posts, created_at for others
      const dateStr =
        post.status === 'scheduled' && post.scheduled_time
          ? post.scheduled_time
          : post.created_at;
      const key = format(parseISO(dateStr), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(post);
    }
    return map;
  }, [allPosts]);

  const totalScheduled = scheduledData?.total ?? 0;
  const totalPublished = publishedData?.total ?? 0;
  const totalDraft = draftData?.total ?? 0;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Calendar</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {totalScheduled} scheduled &middot; {totalPublished} published &middot;{' '}
            {totalDraft} drafts
          </p>
        </div>
        <button
          onClick={() => navigate('/compose')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} />
          New Post
        </button>
      </div>

      {/* Month Navigation */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <button
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 hover:bg-blue-50 rounded"
            >
              Today
            </button>
          </div>
          <button
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-gray-500 py-2 uppercase tracking-wider"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayPosts = postsByDate[dayKey] || [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);

            return (
              <div
                key={idx}
                onClick={() => {
                  if (dayPosts.length === 0) {
                    navigate('/compose');
                  }
                }}
                className={`min-h-[100px] border-b border-r border-gray-100 p-1.5 ${
                  inMonth ? 'bg-white' : 'bg-gray-50'
                } ${dayPosts.length === 0 ? 'cursor-pointer hover:bg-blue-50/30' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-medium leading-none ${
                      today
                        ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center'
                        : inMonth
                        ? 'text-gray-700'
                        : 'text-gray-400'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  {dayPosts.length > 3 && (
                    <span className="text-[10px] text-gray-400">+{dayPosts.length - 3}</span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {dayPosts.slice(0, 3).map((post) => (
                    <PostPill
                      key={post.id}
                      post={post}
                      onClick={() => setSelectedPost(post)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200" />
          <span className="text-xs text-gray-500">Scheduled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-100 border border-green-200" />
          <span className="text-xs text-gray-500">Published</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
          <span className="text-xs text-gray-500">Failed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200" />
          <span className="text-xs text-gray-500">Draft</span>
        </div>
      </div>

      {/* Post Detail Modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onCancel={(id) => cancelMutation.mutate(id)}
        />
      )}
    </div>
  );
}
