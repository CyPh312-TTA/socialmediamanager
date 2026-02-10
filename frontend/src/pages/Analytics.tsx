import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, Heart, MessageCircle } from 'lucide-react';
import { listPosts } from '../api/posts';
import { listAccounts } from '../api/accounts';

export default function Analytics() {
  const { data: postsData } = useQuery({
    queryKey: ['posts'],
    queryFn: () => listPosts(),
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: listAccounts,
  });

  const published = postsData?.items.filter((p) => p.status === 'published') || [];
  const failed = postsData?.items.filter((p) => p.status === 'failed') || [];

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Analytics</h1>
      <p className="text-gray-500 mb-8">Track your social media performance.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp size={20} className="text-green-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{published.length}</p>
              <p className="text-sm text-gray-500">Published Posts</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 size={20} className="text-blue-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{accounts?.length ?? 0}</p>
              <p className="text-sm text-gray-500">Active Accounts</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <MessageCircle size={20} className="text-red-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{failed.length}</p>
              <p className="text-sm text-gray-500">Failed Posts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Post breakdown by platform */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Posts by Platform</h2>
        {accounts && accounts.length > 0 ? (
          <div className="space-y-3">
            {accounts.map((account) => {
              const accountPosts = published.filter((p) =>
                p.platforms.some(
                  (pp) => pp.platform === account.platform && pp.status === 'published',
                ),
              );
              return (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm capitalize">{account.platform}</span>
                    <span className="text-sm text-gray-500">@{account.platform_username}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {accountPosts.length} posts
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Connect accounts to see analytics.</p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <p className="text-sm text-gray-500">
          Detailed analytics with engagement metrics, reach, and impressions will be available
          once platform analytics APIs are connected. This dashboard will show real-time
          performance data across all your accounts.
        </p>
      </div>
    </div>
  );
}
