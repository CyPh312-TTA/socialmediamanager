import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  TrendingUp,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Users,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { getDashboard, refreshMetrics } from '../api/analytics';
import { listAccounts } from '../api/accounts';
import { toast } from '../components/Toast';
import type { PlatformBreakdown } from '../api/analytics';

const PLATFORM_COLORS: Record<string, string> = {
  twitter: 'bg-sky-500',
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-600',
  tiktok: 'bg-gray-900',
};

const PLATFORM_LABELS: Record<string, string> = {
  twitter: '𝕏 Twitter',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  subtext,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  subtext?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
          {subtext && <p className="text-xs text-gray-400 mt-0.5">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}

function EngagementBar({ value, max, label }: { value: number; max: number; label: string }) {
  const width = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-20 text-right">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-blue-500 h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(width, 100)}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 w-16">{formatNumber(value)}</span>
    </div>
  );
}

function PlatformCard({ data }: { data: PlatformBreakdown }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-8 h-8 rounded-lg ${PLATFORM_COLORS[data.platform] || 'bg-gray-500'}`} />
        <div>
          <h3 className="font-semibold text-gray-900">
            {PLATFORM_LABELS[data.platform] || data.platform}
          </h3>
          <p className="text-xs text-gray-500">@{data.platform_username}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900">{formatNumber(data.followers)}</p>
          <p className="text-xs text-gray-500">Followers</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900">{data.posts_count}</p>
          <p className="text-xs text-gray-500">Posts</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900">{data.engagement_rate}%</p>
          <p className="text-xs text-gray-500">Eng. Rate</p>
        </div>
      </div>

      <div className="space-y-2">
        <EngagementBar
          value={data.impressions}
          max={Math.max(data.impressions, data.reach, 1)}
          label="Impressions"
        />
        <EngagementBar
          value={data.reach}
          max={Math.max(data.impressions, data.reach, 1)}
          label="Reach"
        />
        <EngagementBar
          value={data.likes}
          max={Math.max(data.likes, data.comments, data.shares, 1)}
          label="Likes"
        />
        <EngagementBar
          value={data.comments}
          max={Math.max(data.likes, data.comments, data.shares, 1)}
          label="Comments"
        />
        <EngagementBar
          value={data.shares}
          max={Math.max(data.likes, data.comments, data.shares, 1)}
          label="Shares"
        />
      </div>
    </div>
  );
}

function MiniChart({ data, dataKey }: { data: { date: string; [key: string]: any }[]; dataKey: string }) {
  if (data.length === 0) return null;

  const values = data.map((d) => d[dataKey] as number);
  const max = Math.max(...values, 1);

  return (
    <div className="flex items-end gap-px h-16 w-full">
      {data.slice(-14).map((d, i) => {
        const height = (d[dataKey] / max) * 100;
        return (
          <div
            key={i}
            className="flex-1 bg-blue-400 rounded-t-sm hover:bg-blue-600 transition-colors cursor-pointer"
            style={{ height: `${Math.max(height, 2)}%` }}
            title={`${d.date}: ${formatNumber(d[dataKey])}`}
          />
        );
      })}
    </div>
  );
}

export default function Analytics() {
  const [days, setDays] = useState(30);
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['analytics-dashboard', days],
    queryFn: () => getDashboard(days),
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: listAccounts,
  });

  const refreshMutation = useMutation({
    mutationFn: (accountId: string) => refreshMetrics(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics-dashboard'] });
      toast.success('Metrics refreshed successfully!');
    },
    onError: () => {
      toast.error('Failed to refresh metrics');
    },
  });

  const overview = dashboard?.overview;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Track performance across all platforms</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={() => {
              accounts?.forEach((a) => refreshMutation.mutate(a.id));
            }}
            disabled={refreshMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {refreshMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={BarChart3}
              label="Published"
              value={overview?.total_published ?? 0}
              color="bg-blue-500"
              subtext={`${overview?.total_posts ?? 0} total created`}
            />
            <StatCard
              icon={Eye}
              label="Impressions"
              value={formatNumber(overview?.total_impressions ?? 0)}
              color="bg-green-500"
            />
            <StatCard
              icon={Users}
              label="Reach"
              value={formatNumber(overview?.total_reach ?? 0)}
              color="bg-purple-500"
            />
            <StatCard
              icon={TrendingUp}
              label="Engagement"
              value={`${overview?.avg_engagement_rate ?? 0}%`}
              color="bg-orange-500"
              subtext={`${formatNumber(overview?.total_followers ?? 0)} followers`}
            />
          </div>

          {/* Engagement Metrics */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                <Heart size={20} className="text-pink-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {formatNumber(overview?.total_likes ?? 0)}
                </p>
                <p className="text-sm text-gray-500">Likes</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <MessageCircle size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {formatNumber(overview?.total_comments ?? 0)}
                </p>
                <p className="text-sm text-gray-500">Comments</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Share2 size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {formatNumber(overview?.total_shares ?? 0)}
                </p>
                <p className="text-sm text-gray-500">Shares</p>
              </div>
            </div>
          </div>

          {/* Daily Trend Chart */}
          {dashboard?.daily_metrics && dashboard.daily_metrics.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Trends</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500 mb-2">Impressions</p>
                  <MiniChart data={dashboard.daily_metrics} dataKey="impressions" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-2">Engagement Rate (%)</p>
                  <MiniChart data={dashboard.daily_metrics} dataKey="engagement_rate" />
                </div>
              </div>
            </div>
          )}

          {/* Platform Breakdown */}
          {dashboard?.platform_breakdown && dashboard.platform_breakdown.length > 0 ? (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Breakdown</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {dashboard.platform_breakdown.map((pb) => (
                  <PlatformCard key={pb.account_id} data={pb} />
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center mb-8">
              <BarChart3 size={48} className="mx-auto text-gray-300 mb-3" />
              <h3 className="font-medium text-gray-900 mb-1">No platform data yet</h3>
              <p className="text-sm text-gray-500">
                Connect social accounts and publish posts to see analytics here.
              </p>
            </div>
          )}

          {/* Top Posts */}
          {dashboard?.top_posts && dashboard.top_posts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Posts</h2>
              <div className="space-y-3">
                {dashboard.top_posts.map((post, i) => (
                  <div
                    key={`${post.post_id}-${i}`}
                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="text-sm font-bold text-gray-400 w-6 text-center">
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{post.caption}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500 capitalize">{post.platform}</span>
                        {post.published_at && (
                          <span className="text-xs text-gray-400">
                            {new Date(post.published_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span title="Impressions">
                        <Eye size={14} className="inline mr-1" />
                        {formatNumber(post.impressions)}
                      </span>
                      <span title="Likes">
                        <Heart size={14} className="inline mr-1" />
                        {formatNumber(post.likes)}
                      </span>
                      <span title="Comments">
                        <MessageCircle size={14} className="inline mr-1" />
                        {formatNumber(post.comments)}
                      </span>
                      <span className="font-semibold text-green-600">{post.engagement_rate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
