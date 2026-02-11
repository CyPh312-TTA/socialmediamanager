import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  Clock,
  Sparkles,
  Hash,
  Upload,
  X,
  Video,
  Loader2,
  MessageSquarePlus,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { listAccounts } from '../api/accounts';
import { uploadMedia } from '../api/media';
import { createPost } from '../api/posts';
import { generateCaption, generateHashtags } from '../api/ai';
import { toast } from '../components/Toast';
import type { MediaAsset, SocialAccount } from '../types';

const PLATFORM_COLORS: Record<string, string> = {
  twitter: 'bg-sky-100 text-sky-700 border-sky-200',
  instagram: 'bg-pink-100 text-pink-700 border-pink-200',
  facebook: 'bg-blue-100 text-blue-700 border-blue-200',
  tiktok: 'bg-gray-900 text-white border-gray-700',
};

const PLATFORM_ICONS: Record<string, string> = {
  twitter: '𝕏',
  instagram: 'IG',
  facebook: 'FB',
  tiktok: 'TT',
};

const CHAR_LIMITS: Record<string, number> = {
  twitter: 280,
  instagram: 2200,
  facebook: 63206,
  tiktok: 2200,
};

export default function Compose() {
  const navigate = useNavigate();
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [uploadedMedia, setUploadedMedia] = useState<MediaAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDescription, setAiDescription] = useState('');

  // First comment state
  const [firstComment, setFirstComment] = useState('');
  const [showFirstComment, setShowFirstComment] = useState(false);

  // Schedule state
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('');

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: listAccounts,
  });

  const publishMutation = useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      toast.success(
        scheduleMode
          ? 'Post scheduled successfully!'
          : 'Post published successfully!'
      );
      navigate('/');
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.detail || 'Failed to publish post'
      );
    },
  });

  const onDrop = useCallback(async (files: File[]) => {
    setUploading(true);
    try {
      for (const file of files) {
        const asset = await uploadMedia(file);
        setUploadedMedia((prev) => [...prev, asset]);
      }
      toast.success(`${files.length} file(s) uploaded`);
    } catch (err) {
      toast.error('Upload failed. Please try again.');
    }
    setUploading(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov', '.avi', '.webm'],
    },
  });

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const removeMedia = (id: string) => {
    setUploadedMedia((prev) => prev.filter((m) => m.id !== id));
  };

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, '');
    if (tag && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag]);
      setHashtagInput('');
    }
  };

  // Get the most restrictive character limit for selected platforms
  const selectedPlatforms = (accounts || [])
    .filter((a) => selectedAccounts.includes(a.id))
    .map((a) => a.platform);
  const minCharLimit = selectedPlatforms.length
    ? Math.min(...selectedPlatforms.map((p) => CHAR_LIMITS[p] || 2200))
    : 2200;
  const isOverLimit = caption.length > minCharLimit;

  const handleAiCaption = async () => {
    if (!aiDescription.trim()) return;
    setAiLoading(true);
    try {
      const platforms = selectedPlatforms.length ? selectedPlatforms : ['instagram'];
      const result = await generateCaption(aiDescription, platforms);
      const firstCaption = Object.values(result.captions)[0] || '';
      setCaption(firstCaption);
      toast.success('Caption generated!');
    } catch (err) {
      toast.error('AI caption generation failed');
    }
    setAiLoading(false);
  };

  const handleAiHashtags = async () => {
    if (!caption.trim()) return;
    setAiLoading(true);
    try {
      const result = await generateHashtags(caption, 'instagram');
      setHashtags(result.hashtags.slice(0, 20));
      toast.success(`${result.hashtags.length} hashtags generated!`);
    } catch (err) {
      toast.error('AI hashtag generation failed');
    }
    setAiLoading(false);
  };

  const handlePublish = () => {
    if (!caption.trim() || selectedAccounts.length === 0) {
      toast.warning('Please add a caption and select at least one account');
      return;
    }
    if (isOverLimit) {
      toast.warning(`Caption exceeds the ${minCharLimit} character limit`);
      return;
    }
    publishMutation.mutate({
      caption,
      hashtags: hashtags.length ? hashtags : undefined,
      media_ids: uploadedMedia.map((m) => m.id),
      account_ids: selectedAccounts,
      publish_now: true,
    });
  };

  const handleSchedule = () => {
    if (!caption.trim() || selectedAccounts.length === 0) {
      toast.warning('Please add a caption and select at least one account');
      return;
    }
    if (!scheduleTime) {
      toast.warning('Please select a schedule time');
      return;
    }
    publishMutation.mutate({
      caption,
      hashtags: hashtags.length ? hashtags : undefined,
      media_ids: uploadedMedia.map((m) => m.id),
      account_ids: selectedAccounts,
      schedule_time: scheduleTime,
      publish_now: false,
    });
  };

  const handleSaveDraft = () => {
    if (!caption.trim() || selectedAccounts.length === 0) {
      toast.warning('Please add a caption and select at least one account');
      return;
    }
    publishMutation.mutate({
      caption,
      hashtags: hashtags.length ? hashtags : undefined,
      media_ids: uploadedMedia.map((m) => m.id),
      account_ids: selectedAccounts,
      publish_now: false,
    });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Compose Post</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Caption */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={6}
              className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                isOverLimit ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Write your post caption..."
            />
            <div className="flex justify-between mt-2">
              <span className={`text-xs ${isOverLimit ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                {caption.length} / {minCharLimit} characters
              </span>
              {selectedPlatforms.length > 0 && (
                <span className="text-xs text-gray-400">
                  {selectedPlatforms.map((p) => p).join(', ')}
                </span>
              )}
            </div>
          </div>

          {/* Media upload */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Media</label>

            {uploadedMedia.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-4">
                {uploadedMedia.map((media) => (
                  <div key={media.id} className="relative group">
                    <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                      {media.media_type === 'image' ? (
                        <img
                          src={`/uploads/images/${media.file_path.split('/').pop()}`}
                          alt={media.file_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Video size={32} className="text-gray-400" />
                      )}
                    </div>
                    <button
                      onClick={() => removeMedia(media.id)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <Loader2 size={32} className="mx-auto text-blue-500 animate-spin" />
              ) : (
                <>
                  <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">
                    Drag & drop images or videos, or click to browse
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    JPG, PNG, GIF, WebP, MP4, MOV
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Hashtags */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">Hashtags</label>
              <button
                onClick={handleAiHashtags}
                disabled={aiLoading || !caption.trim()}
                className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50 flex items-center gap-1"
              >
                <Sparkles size={14} /> AI Suggest
              </button>
            </div>

            <div className="flex gap-2 mb-3">
              <input
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addHashtag())}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add a hashtag"
              />
              <button
                onClick={addHashtag}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                Add
              </button>
            </div>

            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs"
                  >
                    <Hash size={12} />
                    {tag}
                    <button
                      onClick={() => setHashtags(hashtags.filter((h) => h !== tag))}
                      className="ml-1 hover:text-red-500"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* First Comment */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquarePlus size={18} className="text-gray-600" />
                <label className="block text-sm font-medium text-gray-700">First Comment</label>
              </div>
              <button
                onClick={() => setShowFirstComment(!showFirstComment)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  showFirstComment
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {showFirstComment ? 'Enabled' : 'Add First Comment'}
              </button>
            </div>
            {showFirstComment && (
              <>
                <p className="text-xs text-gray-500 mb-2">
                  Automatically post a comment right after publishing. Great for adding extra
                  hashtags on Instagram or engagement prompts.
                </p>
                <textarea
                  value={firstComment}
                  onChange={(e) => setFirstComment(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="e.g., Drop a comment if you agree! or extra hashtags..."
                />
              </>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Platform selection */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Post to
            </label>
            {accounts?.length ? (
              <div className="space-y-2">
                {accounts.map((account: SocialAccount) => (
                  <button
                    key={account.id}
                    onClick={() => toggleAccount(account.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-sm transition-colors ${
                      selectedAccounts.includes(account.id)
                        ? PLATFORM_COLORS[account.platform]
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-bold text-lg">
                      {PLATFORM_ICONS[account.platform]}
                    </span>
                    <div className="text-left">
                      <p className="font-medium">@{account.platform_username}</p>
                      <p className="text-xs opacity-75 capitalize">{account.platform}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No accounts connected.{' '}
                <a href="/accounts" className="text-blue-600 hover:underline">
                  Connect one
                </a>
              </p>
            )}
          </div>

          {/* AI Assistant */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={18} className="text-purple-600" />
              <h3 className="text-sm font-medium text-gray-700">AI Assistant</h3>
            </div>

            <textarea
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none mb-3"
              placeholder="Describe your post (e.g., 'Product launch for our new sneakers')"
            />

            <button
              onClick={handleAiCaption}
              disabled={aiLoading || !aiDescription.trim()}
              className="w-full py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {aiLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              Generate Caption
            </button>
          </div>

          {/* Schedule */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarIcon size={18} className="text-gray-600" />
                <h3 className="text-sm font-medium text-gray-700">Schedule</h3>
              </div>
              <button
                onClick={() => setScheduleMode(!scheduleMode)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  scheduleMode
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {scheduleMode ? 'Scheduling' : 'Schedule'}
              </button>
            </div>
            {scheduleMode && (
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={new Date().toISOString().slice(0, 16)}
              />
            )}
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            {scheduleMode ? (
              <button
                onClick={handleSchedule}
                disabled={
                  publishMutation.isPending || !caption.trim() || selectedAccounts.length === 0 || !scheduleTime
                }
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {publishMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Clock size={16} />
                )}
                Schedule Post
              </button>
            ) : (
              <button
                onClick={handlePublish}
                disabled={
                  publishMutation.isPending || !caption.trim() || selectedAccounts.length === 0
                }
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {publishMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Publish Now
              </button>
            )}

            <button
              onClick={handleSaveDraft}
              disabled={
                publishMutation.isPending || !caption.trim() || selectedAccounts.length === 0
              }
              className="w-full py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Clock size={16} />
              Save as Draft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
