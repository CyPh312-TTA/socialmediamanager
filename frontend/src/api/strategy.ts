import { api } from './client';

export interface StrategyQuestionnaire {
  business_type: string;
  target_audience: string;
  goals: string[];
  platforms: string[];
  tone: string;
  posting_frequency: string;
  content_pillars?: string[];
}

export interface ContentPillar {
  name: string;
  description: string;
  percentage: number;
  sample_topics: string[];
}

export interface WeeklySlot {
  day_of_week: string;
  time: string;
  pillar: string;
  post_type: string;
}

export interface StrategyResponse {
  pillars: ContentPillar[];
  weekly_schedule: WeeklySlot[];
  post_ideas: Record<string, unknown>[];
  hashtag_strategy: Record<string, string[]>;
  growth_tactics: string[];
}

export const generateStrategy = (data: StrategyQuestionnaire) =>
  api.post<StrategyResponse>('/strategy/generate', data).then(r => r.data);

export const generatePostIdeas = (data: { strategy_context: string; count?: number; platform: string }) =>
  api.post<{ ideas: { caption: string; hashtags: string[]; post_type: string; platform: string }[] }>('/strategy/post-ideas', data).then(r => r.data);

export const analyzePerformance = (postData: Record<string, unknown>[]) =>
  api.post<{ insights: string[]; recommendations: string[]; top_performing_types: string[] }>('/strategy/analyze', { post_data: postData }).then(r => r.data);
