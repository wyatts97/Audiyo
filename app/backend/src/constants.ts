export const API_CONSTANTS = {
  TIMEOUTS: {
    ITUNES_SEARCH: 10000,
    MUSICBRAINZ_SEARCH: 10000,
    ARTWORK_DOWNLOAD: 15000,
  },
  LIMITS: {
    MAX_JOBS: 100,
    MAX_HISTORY: 100,
    MAX_SEARCH_RESULTS: 50,
    LIBRARY_PAGE_SIZE: 12,
  },
  INTERVALS: {
    JOB_PROCESSOR_CHECK: 5000,
    OLD_JOBS_CLEANUP: 24 * 60 * 60 * 1000,
  },
  CLEANUP: {
    OLD_JOBS_DAYS: 7,
  },
  CACHE: {
    ARTWORK_MAX_AGE: 86400,
    AUDIO_MAX_AGE: 86400,
  },
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000,
    MAX_REQUESTS: 10000,
  },
} as const;

export const AUDIO_FORMATS = {
  SUPPORTED: ['mp3', 'opus', 'flac'] as const,
  EXTENSIONS: ['.mp3', '.opus', '.flac', '.m4a', '.webm'] as const,
  MIME_TYPES: {
    '.mp3': 'audio/mpeg',
    '.opus': 'audio/opus',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
  } as const,
} as const;

export const URL_PATTERNS = {
  YOUTUBE: /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/playlist\?list=)/,
  SOUNDCLOUD: /soundcloud\.com\//,
} as const;

export type AudioFormat = typeof AUDIO_FORMATS.SUPPORTED[number];
