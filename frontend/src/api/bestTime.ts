import { api } from './client';

export interface BestTimeSlot {
  day_of_week: number;
  hour_utc: number;
  avg_engagement_rate: number;
  avg_impressions: number;
  sample_count: number;
  day_name: string;
}

export interface HeatmapCell {
  day_of_week: number;
  hour_utc: number;
  value: number;
}

export const getBestTimes = (accountId: string) =>
  api.get<{ account_id: string; platform: string; best_times: BestTimeSlot[] }>(
    `/best-times/${accountId}`
  ).then(r => r.data);

export const getHeatmap = (accountId: string) =>
  api.get<{ account_id: string; platform: string; data: HeatmapCell[] }>(
    `/best-times/${accountId}/heatmap`
  ).then(r => r.data);

export const analyzeBestTimes = (accountId: string) =>
  api.post(`/best-times/${accountId}/analyze`).then(r => r.data);
