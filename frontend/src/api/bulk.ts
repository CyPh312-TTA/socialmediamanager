import { api } from './client';

export interface BulkPreviewEntry {
  row_number: number;
  caption: string;
  platforms: string[];
  schedule_time: string;
  is_valid: boolean;
  error: string | null;
}

export interface BulkPreviewResponse {
  total_rows: number;
  valid_count: number;
  error_count: number;
  entries: BulkPreviewEntry[];
}

export const uploadBulkCSV = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post<BulkPreviewResponse>('/bulk/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const confirmBulkSchedule = (entries: Record<string, unknown>[]) =>
  api.post<{ created: number; failed: number; errors: string[] }>('/bulk/confirm', { entries }).then(r => r.data);

export const downloadTemplate = () =>
  api.get('/bulk/template', { responseType: 'blob' }).then(r => r.data);
