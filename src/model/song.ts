import { HttpError } from "../helpers/errors";

export enum Platform {
  YOUTUBE = 'youtube',
  SPOTIFY = 'spotify'
}

export interface Song {
  song_id: number;
  title: string;
  artist: string;
  duration: number | null;  // Duration in seconds
  platform: Platform;
  url: string;
  added_at: Date;
  image_path: string | null;
}

export interface SongInPlaylist extends Song {
  playlist_id?: number;
}

const YOUTUBE_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
  /^https?:\/\/youtu\.be\/[\w-]+/,
  /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/
];

const SPOTIFY_PATTERNS = [
  /^https?:\/\/open\.spotify\.com\/track\/[\w]+/,
  /^https?:\/\/open\.spotify\.com\/intl-[\w]+\/track\/[\w]+/
];

export function detectPlatform(url: string): Platform | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    if (pattern.test(url)) return Platform.YOUTUBE;
  }
  for (const pattern of SPOTIFY_PATTERNS) {
    if (pattern.test(url)) return Platform.SPOTIFY;
  }
  return null;
}

export function isValidSongUrl(url: string): boolean {
  return detectPlatform(url) !== null;
}

export class SongValidator {
  title: string;
  artist: string;
  duration: number | null;
  platform: Platform;
  url: string;
  image_path: string | null;

  constructor(
    title: string,
    artist: string,
    url: string,
    duration: number | null = null,
    image_path: string | null = null,
    platform?: Platform 
  ) {
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new HttpError(400, 'Song title is required');
    }
    if (title.trim().length > 255) {
      throw new HttpError(400, 'Song title must be at most 255 characters');
    }

    if (!artist || typeof artist !== 'string' || artist.trim().length === 0) {
      throw new HttpError(400, 'Artist name is required');
    }
    if (artist.trim().length > 255) {
      throw new HttpError(400, 'Artist name must be at most 255 characters');
    }

    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      throw new HttpError(400, 'Song URL is required');
    }
    if (url.trim().length > 500) {
      throw new HttpError(400, 'Song URL must be at most 500 characters');
    }

    const detectedPlatform = detectPlatform(url.trim());
    if (!detectedPlatform) {
      throw new HttpError(400, 'Invalid URL. Only YouTube and Spotify links are allowed');
    }

    if (platform && platform !== detectedPlatform) {
      throw new HttpError(400, `URL does not match specified platform. Detected: ${detectedPlatform}, Specified: ${platform}`);
    }

    if (duration !== null) {
      if (typeof duration !== 'number' || duration < 0) {
        throw new HttpError(400, 'Duration must be a positive number (seconds)');
      }
    }

    if (image_path !== null && typeof image_path !== 'string') {
      throw new HttpError(400, 'Image path must be a string');
    }

    this.title = title.trim();
    this.artist = artist.trim();
    this.url = url.trim();
    this.platform = detectedPlatform;
    this.duration = duration;
    this.image_path = image_path ? image_path.trim() : null;
  }
}

export class SongUpdateValidator {
  title?: string;
  artist?: string;
  duration?: number | null;
  url?: string;
  platform?: Platform;
  image_path?: string | null;

  constructor(data: {
    title?: string;
    artist?: string;
    duration?: number | null;
    url?: string;
    image_path?: string | null;
  }) {
    if (data.title !== undefined) {
      if (typeof data.title !== 'string' || data.title.trim().length === 0) {
        throw new HttpError(400, 'Song title cannot be empty');
      }
      if (data.title.trim().length > 255) {
        throw new HttpError(400, 'Song title must be at most 255 characters');
      }
      this.title = data.title.trim();
    }

    if (data.artist !== undefined) {
      if (typeof data.artist !== 'string' || data.artist.trim().length === 0) {
        throw new HttpError(400, 'Artist name cannot be empty');
      }
      if (data.artist.trim().length > 255) {
        throw new HttpError(400, 'Artist name must be at most 255 characters');
      }
      this.artist = data.artist.trim();
    }

    if (data.url !== undefined) {
      if (typeof data.url !== 'string' || data.url.trim().length === 0) {
        throw new HttpError(400, 'Song URL cannot be empty');
      }
      const detectedPlatform = detectPlatform(data.url.trim());
      if (!detectedPlatform) {
        throw new HttpError(400, 'Invalid URL. Only YouTube and Spotify links are allowed');
      }
      this.url = data.url.trim();
      this.platform = detectedPlatform;
    }

    if (data.duration !== undefined) {
      if (data.duration !== null && (typeof data.duration !== 'number' || data.duration < 0)) {
        throw new HttpError(400, 'Duration must be a positive number (seconds) or null');
      }
      this.duration = data.duration;
    }

    if (data.image_path !== undefined) {
      if (data.image_path !== null && typeof data.image_path !== 'string') {
        throw new HttpError(400, 'Image path must be a string or null');
      }
      this.image_path = data.image_path ? data.image_path.trim() : null;
    }
  }
}
