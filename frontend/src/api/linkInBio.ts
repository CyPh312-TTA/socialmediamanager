import { api } from './client';

export interface BioLink {
  id: string;
  title: string;
  url: string;
  icon: string | null;
  thumbnail_url: string | null;
  position: number;
  is_active: boolean;
  click_count: number;
}

export interface BioPage {
  id: string;
  slug: string;
  title: string;
  bio: string | null;
  avatar_url: string | null;
  theme: string;
  bg_color: string;
  text_color: string;
  button_style: string;
  is_published: boolean;
  total_views: number;
  links: BioLink[];
}

export const listBioPages = () =>
  api.get<BioPage[]>('/bio/bio-pages').then(r => r.data);

export const createBioPage = (data: { slug: string; title: string; bio?: string; theme?: string; bg_color?: string; text_color?: string; button_style?: string }) =>
  api.post<BioPage>('/bio/bio-pages', data).then(r => r.data);

export const getBioPage = (pageId: string) =>
  api.get<BioPage>(`/bio/bio-pages/${pageId}`).then(r => r.data);

export const updateBioPage = (pageId: string, data: Partial<BioPage>) =>
  api.put<BioPage>(`/bio/bio-pages/${pageId}`, data).then(r => r.data);

export const deleteBioPage = (pageId: string) =>
  api.delete(`/bio/bio-pages/${pageId}`);

export const addBioLink = (pageId: string, data: { title: string; url: string; icon?: string }) =>
  api.post<BioLink>(`/bio/bio-pages/${pageId}/links`, data).then(r => r.data);

export const updateBioLink = (pageId: string, linkId: string, data: Partial<BioLink>) =>
  api.put<BioLink>(`/bio/bio-pages/${pageId}/links/${linkId}`, data).then(r => r.data);

export const deleteBioLink = (pageId: string, linkId: string) =>
  api.delete(`/bio/bio-pages/${pageId}/links/${linkId}`);

export const reorderBioLinks = (pageId: string, linkIds: string[]) =>
  api.put(`/bio/bio-pages/${pageId}/links/reorder`, { link_ids: linkIds });

export const getBioAnalytics = (pageId: string, days?: number) =>
  api.get(`/bio/bio-pages/${pageId}/analytics`, { params: { days } }).then(r => r.data);
