import { api } from './client';

export interface AnalyticsOverview {
  total_posts: number;
  total_published: number;
  total_impressions: number;
  total_reach: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  avg_engagement_rate: number;
  total_followers: number;
}

export interface PlatformBreakdown {
  platform: string;
  platform_username: string;
  account_id: string;
  posts_count: number;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  followers: number;
  engagement_rate: number;
}

export interface PostPerformance {
  post_id: string;
  caption: string;
  platform: string;
  published_at: string | null;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
}

export interface DailyMetric {
  date: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  engagement_rate: number;
}

export interface AnalyticsDashboard {
  overview: AnalyticsOverview;
  platform_breakdown: PlatformBreakdown[];
  top_posts: PostPerformance[];
  daily_metrics: DailyMetric[];
}

export async function getDashboard(days = 30) {
  const resp = await api.get<AnalyticsDashboard>('/analytics/dashboard', {
    params: { days },
  });
  return resp.data;
}

export async function refreshMetrics(accountId: string) {
  const resp = await api.post(`/analytics/refresh/${accountId}`);
  return resp.data;
}
