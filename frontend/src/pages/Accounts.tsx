import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, Trash2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { listAccounts, startOAuth, disconnectAccount } from '../api/accounts';
import type { SocialAccount } from '../types';

const PLATFORMS = [
  {
    id: 'twitter',
    name: 'Twitter / X',
    icon: '𝕏',
    color: 'bg-gray-900 text-white hover:bg-gray-800',
    description: 'Post tweets with images and videos',
  },
  {
    id: 'meta',
    name: 'Instagram & Facebook',
    icon: 'META',
    color: 'bg-blue-600 text-white hover:bg-blue-700',
    description: 'Connect both Instagram and Facebook via Meta',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: 'TT',
    color: 'bg-black text-white hover:bg-gray-900',
    description: 'Upload and publish videos',
  },
];

export default function Accounts() {
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: listAccounts,
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectAccount,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  });

  const handleConnect = async (platform: string) => {
    try {
      const url = await startOAuth(platform);
      window.location.href = url;
    } catch (err) {
      console.error('Failed to start OAuth:', err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Connected Accounts</h1>
      <p className="text-gray-500 mb-8">
        Connect your social media accounts to start publishing.
      </p>

      {/* Connected accounts */}
      {accounts && accounts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Accounts</h2>
          <div className="space-y-3">
            {accounts.map((account: SocialAccount) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center font-bold text-sm">
                    {account.platform === 'twitter'
                      ? '𝕏'
                      : account.platform === 'instagram'
                      ? 'IG'
                      : account.platform === 'facebook'
                      ? 'FB'
                      : 'TT'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">@{account.platform_username}</p>
                    <p className="text-sm text-gray-500 capitalize">{account.platform}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {account.is_active ? (
                    <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                      <CheckCircle size={14} /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2.5 py-1 rounded-full">
                      <AlertCircle size={14} /> Reconnect needed
                    </span>
                  )}
                  <button
                    onClick={() => disconnectMutation.mutate(account.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Disconnect"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connect new accounts */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {accounts?.length ? 'Connect More Accounts' : 'Connect Your First Account'}
        </h2>
        <div className="space-y-3">
          {PLATFORMS.map((platform) => (
            <div
              key={platform.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center font-bold text-sm">
                  {platform.icon}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{platform.name}</p>
                  <p className="text-sm text-gray-500">{platform.description}</p>
                </div>
              </div>
              <button
                onClick={() => handleConnect(platform.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${platform.color}`}
              >
                <ExternalLink size={16} />
                Connect
              </button>
            </div>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        </div>
      )}
    </div>
  );
}
