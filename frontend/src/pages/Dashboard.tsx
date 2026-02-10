import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PenSquare, Image, Link2, BarChart3 } from 'lucide-react';
import { listPosts } from '../api/posts';
import { listAccounts } from '../api/accounts';
import { listMedia } from '../api/media';
import { useAuthStore } from '../store/authStore';

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: postsData } = useQuery({
    queryKey: ['posts'],
    queryFn: () => listPosts(),
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: listAccounts,
  });

  const { data: mediaData } = useQuery({
    queryKey: ['media'],
    queryFn: () => listMedia(),
  });

  const stats = [
    {
      label: 'Total Posts',
      value: postsData?.total ?? 0,
      icon: PenSquare,
      color: 'bg-blue-100 text-blue-700',
    },
    {
      label: 'Media Assets',
      value: mediaData?.total ?? 0,
      icon: Image,
      color: 'bg-purple-100 text-purple-700',
    },
    {
      label: 'Connected Accounts',
      value: accounts?.length ?? 0,
      icon: Link2,
      color: 'bg-green-100 text-green-700',
    },
    {
      label: 'Published',
      value: postsData?.items.filter((p) => p.status === 'published').length ?? 0,
      icon: BarChart3,
      color: 'bg-orange-100 text-orange-700',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back{user?.full_name ? `, ${user.full_name}` : ''}
        </h1>
        <p className="text-gray-500 mt-1">Here's an overview of your social media activity.</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-gray-200 p-6"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat.color}`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/compose')}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <PenSquare size={18} />
            Create Post
          </button>
          <button
            onClick={() => navigate('/media')}
            className="px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Image size={18} />
            Upload Media
          </button>
          <button
            onClick={() => navigate('/accounts')}
            className="px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Link2 size={18} />
            Connect Account
          </button>
        </div>
      </div>

      {/* Recent posts */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Posts</h2>
        {postsData?.items.length ? (
          <div className="space-y-3">
            {postsData.items.slice(0, 5).map((post) => (
              <div
                key={post.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{post.caption}</p>
                  <div className="flex gap-2 mt-1">
                    {post.platforms.map((pp) => (
                      <span
                        key={pp.id}
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          pp.status === 'published'
                            ? 'bg-green-100 text-green-700'
                            : pp.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {pp.platform}
                      </span>
                    ))}
                  </div>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    post.status === 'published'
                      ? 'bg-green-100 text-green-700'
                      : post.status === 'failed'
                      ? 'bg-red-100 text-red-700'
                      : post.status === 'scheduled'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {post.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No posts yet. Create your first post!</p>
        )}
      </div>
    </div>
  );
}
