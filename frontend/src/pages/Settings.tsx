import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Key, User as UserIcon, Sliders, Loader2, Check } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { updateProfile, changePassword, getPreferences, updatePreferences } from '../api/settings';
import { getMe } from '../api/auth';
import { toast } from '../components/Toast';

export default function Settings() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();

  // Profile state
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Preferences state
  const [defaultTone, setDefaultTone] = useState('professional');
  const [hashtagCount, setHashtagCount] = useState(20);
  const [autoHashtags, setAutoHashtags] = useState(false);
  const [timezone, setTimezone] = useState('UTC');

  // Load preferences
  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: getPreferences,
  });

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    if (preferences) {
      setDefaultTone(preferences.default_tone);
      setHashtagCount(preferences.default_hashtag_count);
      setAutoHashtags(preferences.auto_hashtags);
      setTimezone(preferences.posting_timezone);
    }
  }, [preferences]);

  // Profile mutation
  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      const updatedUser = await getMe();
      setUser(updatedUser);
      toast.success('Profile updated successfully!');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to update profile');
    },
  });

  // Password mutation
  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully!');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to change password');
    },
  });

  // Preferences mutation
  const prefsMutation = useMutation({
    mutationFn: updatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
      toast.success('Preferences saved!');
    },
    onError: () => {
      toast.error('Failed to save preferences');
    },
  });

  const handleProfileSave = () => {
    const updates: Record<string, string> = {};
    if (fullName !== user?.full_name) updates.full_name = fullName;
    if (email !== user?.email) updates.email = email;
    if (Object.keys(updates).length === 0) {
      toast.info('No changes to save');
      return;
    }
    profileMutation.mutate(updates);
  };

  const handlePasswordChange = () => {
    if (!currentPassword || !newPassword) {
      toast.warning('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.warning('Password must be at least 8 characters');
      return;
    }
    passwordMutation.mutate({
      current_password: currentPassword,
      new_password: newPassword,
    });
  };

  const handlePrefsSave = () => {
    prefsMutation.mutate({
      default_tone: defaultTone,
      default_hashtag_count: hashtagCount,
      auto_hashtags: autoHashtags,
      posting_timezone: timezone,
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Profile Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <UserIcon size={20} className="text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
            <span className="inline-block px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium capitalize">
              {user?.plan || 'free'}
            </span>
          </div>
          <button
            onClick={handleProfileSave}
            disabled={profileMutation.isPending}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {profileMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Save Profile
          </button>
        </div>
      </div>

      {/* Password Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Key size={20} className="text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Minimum 8 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Re-enter new password"
            />
          </div>
          <button
            onClick={handlePasswordChange}
            disabled={passwordMutation.isPending}
            className="px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
          >
            {passwordMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Key size={16} />
            )}
            Change Password
          </button>
        </div>
      </div>

      {/* AI Preferences Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Sliders size={20} className="text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">AI Preferences</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Tone</label>
            <select
              value={defaultTone}
              onChange={(e) => setDefaultTone(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="funny">Funny</option>
              <option value="inspirational">Inspirational</option>
              <option value="educational">Educational</option>
              <option value="promotional">Promotional</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Hashtag Count
            </label>
            <select
              value={hashtagCount}
              onChange={(e) => setHashtagCount(Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Posting Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern (ET)</option>
              <option value="America/Chicago">Central (CT)</option>
              <option value="America/Denver">Mountain (MT)</option>
              <option value="America/Los_Angeles">Pacific (PT)</option>
              <option value="Europe/London">London (GMT)</option>
              <option value="Europe/Paris">Paris (CET)</option>
              <option value="Asia/Tokyo">Tokyo (JST)</option>
              <option value="Australia/Sydney">Sydney (AEST)</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoHashtags(!autoHashtags)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoHashtags ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoHashtags ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <label className="text-sm text-gray-700">Auto-generate hashtags on post creation</label>
          </div>
          <button
            onClick={handlePrefsSave}
            disabled={prefsMutation.isPending}
            className="px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            {prefsMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            Save Preferences
          </button>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Account ID</span>
            <span className="font-mono text-xs text-gray-400">{user?.id}</span>
          </div>
          <div className="flex justify-between">
            <span>Member since</span>
            <span>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</span>
          </div>
          <div className="flex justify-between">
            <span>Status</span>
            <span className="text-green-600 font-medium">
              {user?.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
