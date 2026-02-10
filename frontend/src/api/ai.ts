import api from './client';
import type { CaptionResponse, HashtagResponse } from '../types';

export async function generateCaption(
  description: string,
  platforms: string[],
  tone = 'professional',
  keywords?: string[],
) {
  const resp = await api.post<CaptionResponse>('/ai/generate-caption', {
    description,
    platforms,
    tone,
    keywords,
  });
  return resp.data;
}

export async function generateHashtags(caption: string, platform: string, category?: string) {
  const resp = await api.post<HashtagResponse>('/ai/generate-hashtags', {
    caption,
    platform,
    category,
  });
  return resp.data;
}

export async function rewriteCaption(caption: string, sourcePlatform: string, targetPlatform: string) {
  const resp = await api.post<{ rewritten_caption: string }>('/ai/rewrite', {
    caption,
    source_platform: sourcePlatform,
    target_platform: targetPlatform,
  });
  return resp.data.rewritten_caption;
}

export async function generateCalendar(
  startDate: string,
  endDate: string,
  platforms: string[],
  contentThemes?: string[],
  postsPerDay = 1,
) {
  const resp = await api.post('/ai/generate-calendar', {
    start_date: startDate,
    end_date: endDate,
    platforms,
    content_themes: contentThemes,
    posts_per_day: postsPerDay,
  });
  return resp.data;
}
