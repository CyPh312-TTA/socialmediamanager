export interface User {
  id: string;
  email: string;
  full_name: string;
  plan: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface SocialAccount {
  id: string;
  platform: 'instagram' | 'facebook' | 'twitter' | 'tiktok';
  platform_username: string;
  account_type: string;
  is_active: boolean;
  connected_at: string;
}

export interface MediaAsset {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  media_type: 'image' | 'video';
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  thumbnail_path: string | null;
  alt_text: string | null;
  created_at: string;
}

export interface PostPlatformStatus {
  id: string;
  platform: string;
  platform_username: string;
  status: 'pending' | 'published' | 'failed';
  error_message: string | null;
  published_at: string | null;
}

export interface Post {
  id: string;
  caption: string;
  hashtags: string[] | null;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  post_type: string;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
  platforms: PostPlatformStatus[];
}

export interface CaptionResponse {
  captions: Record<string, string>;
  variations: Record<string, string>[] | null;
}

export interface HashtagResponse {
  hashtags: string[];
  broad: string[];
  niche: string[];
}

export interface CalendarSlot {
  date: string;
  time: string;
  platform: string;
  content_type: string;
  theme: string;
  suggested_caption: string;
}
