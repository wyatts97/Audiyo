import { z } from 'zod';
import { AUDIO_FORMATS, URL_PATTERNS } from './constants';

export const jobCreateSchema = z.object({
  url: z.string()
    .url('Invalid URL format')
    .refine(
      (url) => URL_PATTERNS.YOUTUBE.test(url) || URL_PATTERNS.SOUNDCLOUD.test(url),
      'URL must be from YouTube or SoundCloud'
    ),
  format: z.enum(AUDIO_FORMATS.SUPPORTED).default('mp3'),
  force: z.boolean().optional(),
});

export const trackUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  artist: z.string().min(1).max(500).optional(),
  album: z.string().min(1).max(500).optional(),
  genre: z.string().max(100).optional(),
  year: z.string().regex(/^\d{4}$/, 'Year must be 4 digits').optional(),
});

export const settingsUpdateSchema = z.object({
  libraryPath: z.string().optional(),
  showPlatformBadges: z.boolean().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
});

export type JobCreateInput = z.infer<typeof jobCreateSchema>;
export type TrackUpdateInput = z.infer<typeof trackUpdateSchema>;
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
