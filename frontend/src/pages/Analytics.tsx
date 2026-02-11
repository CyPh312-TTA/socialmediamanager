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
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getDashboard, refreshMetrics } from '../api/analytics';
import { getHeatmap } from '../api/bestTime';
import { listAccounts } from '../api/accounts';
import { toast } from '../components/Toast';
import type { PlatformBreakdown } from '../api/analytics';
import type { HeatmapCell } from '../api/bestTime';

const PLATFORM_COLORS: Record<string, string> = {
  twitter: 'bg-sky-500',
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-600',
  tiktok: 'bg-gray-900',
};

const PLATFORM_LABELS: Record<string, string> = {
  twitter: '\uD835\uDD4F Twitter',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

function EngagementHeatmap({ data }: { data: HeatmapCell[] }) {
  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        No engagement data available yet. Publish posts and wait for analytics to accumulate.
      </p>
    );
  }

  // Build a 7×24 grid
  const grid: Record<string, number> = {};
  let maxVal = 0;
  for (const cell of data) {
    const key = `${cell.day_of_week}-${cell.hour_utc}`;
    grid[key] = cell.value;
    if (cell.value > maxVal) maxVal = cell.value;
  }

  function getColor(val: number): string {
    if (maxVal === 0) return 'bg-gray-100';
    const ratio = val / maxVal;
    if (ratio === 0) return 'bg-gray-100';
    if (ratio < 0.2) return 'bg-blue-100';
    if (ratio < 0.4) return 'bg-blue-200';
    if (ratio < 0.6) return 'bg-blue-300';
    if (ratio < 0.8) return 'bg-blue-400';
    return 'bg-blue-600';
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex gap-px mb-1 ml-10">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="flex-1 text-center text-[10px] text-gray-400">
              {h % 3 === 0 ? `${h}h` : ''}
            </div>
          ))}
        </div>
        {/* Rows for each day */}
        {Array.from({ length: 7 }, (_, dayIdx) => (
          <div key={dayIdx} className="flex gap-px items-center mb-px">
            <span className="text-xs text-gray-500 w-10 text-right pr-2 flex-shrink-0">
              {DAY_NAMES[dayIdx]}
            </span>
            {Array.from({ length: 24 }, (_, hour) => {
              const val = grid[`${dayIdx}-${hour}`] || 0;
              return (
                <div
                  key={hour}
                  className={`flex-1 h-5 rounded-sm ${getColor(val)} transition-colors`}
                  title={`${DAY_NAMES[dayIdx]} ${hour}:00 — ${val.toFixed(2)}% engagement`}
                />
              );
            })}
          </div>
        ))}
        {/* Color legend */}
        <div className="flex items-center gap-2 mt-3 ml-10">
          <span className="text-[10px] text-gray-400">Low</span>
          <div className="flex gap-px">
            {['bg-gray-100', 'bg-blue-100', 'bg-blue-200', 'bg-blue-300', 'bg-blue-400', 'bg-blue-600'].map(
              (c, i) => (
                <div key={i} className={`w-4 h-3 rounded-sm ${c}`} />
              )
            )}
          </div>
          <span className="text-[10px] text-gray-400">High</span>
        </div>
      </div>
    </div>
  );
}

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [heatmapAccountId, setHeatmapAccountId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['analytics-dashboard', days],
    queryFn: () => getDashboard(days),
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: listAccounts,
  });

  // Set default heatmap account when accounts load
  const selectedHeatmapId = heatmapAccountId || (accounts && accounts.length > 0 ? accounts[0].id : null);

  const { data: heatmapData } = useQuery({
    queryKey: ['heatmap', selectedHeatmapId],
    queryFn: () => getHeatmap(selectedHeatmapId!),
    enabled: !!selectedHeatmapId,
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

          {/* Daily Trend Charts — Recharts */}
          {dashboard?.daily_metrics && dashboard.daily_metrics.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Trends</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500 mb-2">Impressions</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={dashboard.daily_metrics}>
                      <defs>
                        <linearGradient id="impressionsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => String(d).slice(5)}
                        tick={{ fontSize: 10, fill: '#9CA3AF' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => formatNumber(Number(v))}
                        tick={{ fontSize: 10, fill: '#9CA3AF' }}
                        axisLine={false}
                        tickLine={false}
                        width={45}
                      />
                      <Tooltip
                        formatter={(value: unknown) => [formatNumber(Number(value ?? 0)), 'Impressions']}
                        labelFormatter={(label: unknown) => `Date: ${label}`}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="impressions"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        fill="url(#impressionsGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-2">Engagement Rate (%)</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={dashboard.daily_metrics}>
                      <defs>
                        <linearGradient id="engagementGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => String(d).slice(5)}
                        tick={{ fontSize: 10, fill: '#9CA3AF' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fontSize: 10, fill: '#9CA3AF' }}
                        axisLine={false}
                        tickLine={false}
                        width={45}
                      />
                      <Tooltip
                        formatter={(value: unknown) => [`${Number(value ?? 0)}%`, 'Engagement']}
                        labelFormatter={(label: unknown) => `Date: ${label}`}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="engagement_rate"
                        stroke="#10B981"
                        strokeWidth={2}
                        fill="url(#engagementGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Best Times to Post — Heatmap */}
          {accounts && accounts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Best Times to Post</h2>
                {accounts.length > 1 && (
                  <select
                    value={selectedHeatmapId || ''}
                    onChange={(e) => setHeatmapAccountId(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        @{a.platform_username} ({a.platform})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-3">
                Engagement rate by day and hour (UTC). Darker = higher engagement.
              </p>
              <EngagementHeatmap data={heatmapData?.data || []} />
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
