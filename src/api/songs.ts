import { Router, Request, Response, NextFunction } from 'express';
import { HttpError } from '../helpers/errors';
import { detectPlatform, Platform } from '../model/song';

export const songsRouter = Router();

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractSpotifyId(url: string): string | null {
  const match = url.match(/spotify\.com\/(?:intl-[a-z]+\/)?track\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function parseYouTubeDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  return hours * 3600 + minutes * 60 + seconds;
}

async function fetchYouTubeMetadata(videoId: string) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new HttpError(500, 'YouTube API key not configured');
  }

  const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${apiKey}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    throw new HttpError(404, 'YouTube video not found');
  }

  const item = data.items[0];
  const snippet = item.snippet;
  const contentDetails = item.contentDetails;

  let artist = snippet.channelTitle || 'Unknown';
  let title = snippet.title || 'Unknown';

  const separators = [' - ', ' – ', ' — ', ' | '];
  for (const sep of separators) {
    if (title.includes(sep)) {
      const parts = title.split(sep);
      artist = parts[0].trim();
      title = parts.slice(1).join(sep).trim();
      break;
    }
  }

  title = title
    .replace(/\(Official.*?\)/gi, '')
    .replace(/\[Official.*?\]/gi, '')
    .replace(/\(Lyrics.*?\)/gi, '')
    .replace(/\[Lyrics.*?\]/gi, '')
    .replace(/\(Audio.*?\)/gi, '')
    .replace(/\[Audio.*?\]/gi, '')
    .replace(/\(Music Video\)/gi, '')
    .replace(/\[Music Video\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    title,
    artist,
    duration: parseYouTubeDuration(contentDetails.duration),
    thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || null,
    platform: Platform.YOUTUBE
  };
}

let spotifyToken = '';
let spotifyTokenExpiry = 0;

async function getSpotifyToken(): Promise<string> {
  if (spotifyToken && Date.now() < spotifyTokenExpiry) {
    return spotifyToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new HttpError(500, 'Spotify API credentials not configured');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  if (!data.access_token) {
    throw new HttpError(500, 'Failed to get Spotify access token');
  }

  spotifyToken = data.access_token;
  spotifyTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return spotifyToken;
}

async function fetchSpotifyMetadata(trackId: string) {
  const token = await getSpotifyToken();

  const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new HttpError(404, 'Spotify track not found');
  }

  const data = await response.json();

  return {
    title: data.name,
    artist: data.artists.map((a: any) => a.name).join(', '),
    duration: Math.round(data.duration_ms / 1000),
    thumbnail: data.album?.images?.[0]?.url || null,
    platform: Platform.SPOTIFY
  };
}

songsRouter.get('/metadata', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const url = req.query.url as string;
    if (!url) {
      throw new HttpError(400, 'URL is required');
    }

    const platform = detectPlatform(url);
    if (!platform) {
      throw new HttpError(400, 'Invalid URL. Only YouTube and Spotify links are supported');
    }

    let metadata;
    if (platform === Platform.YOUTUBE) {
      const videoId = extractYouTubeId(url);
      if (!videoId) {
        throw new HttpError(400, 'Could not extract YouTube video ID');
      }
      metadata = await fetchYouTubeMetadata(videoId);
    } else {
      const trackId = extractSpotifyId(url);
      if (!trackId) {
        throw new HttpError(400, 'Could not extract Spotify track ID');
      }
      metadata = await fetchSpotifyMetadata(trackId);
    }

    res.json(metadata);
  } catch (error) {
    next(error);
  }
});
