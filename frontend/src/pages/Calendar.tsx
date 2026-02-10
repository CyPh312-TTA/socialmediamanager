import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock } from 'lucide-react';
import { listPosts } from '../api/posts';
import { format } from 'date-fns';
import type { Post } from '../types';

export default function Calendar() {
  const { data: postsData } = useQuery({
    queryKey: ['posts', 'scheduled'],
    queryFn: () => listPosts('scheduled'),
  });

  const { data: publishedData } = useQuery({
    queryKey: ['posts', 'published'],
    queryFn: () => listPosts('published'),
  });

  const allPosts = [
    ...(postsData?.items || []),
    ...(publishedData?.items || []),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Calendar</h1>
          <p className="text-gray-500 mt-1">
            {postsData?.total ?? 0} scheduled, {publishedData?.total ?? 0} published
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {allPosts.length > 0 ? (
          <div className="space-y-4">
            {allPosts.map((post: Post) => (
              <div key={post.id} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      post.status === 'scheduled'
                        ? 'bg-blue-100 text-blue-700'
                        : post.status === 'published'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {post.status === 'scheduled' ? (
                      <Clock size={20} />
                    ) : (
                      <CalendarDays size={20} />
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">
                    {post.caption}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-500">
                      {format(new Date(post.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        post.status === 'published'
                          ? 'bg-green-100 text-green-700'
                          : post.status === 'scheduled'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {post.status}
                    </span>
                    {post.platforms.map((pp) => (
                      <span
                        key={pp.id}
                        className="text-xs text-gray-500 capitalize"
                      >
                        {pp.platform}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <CalendarDays size={48} className="mx-auto mb-3 text-gray-300" />
            <p>No scheduled or published posts yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
