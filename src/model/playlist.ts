import { HttpError } from "../helpers/errors";

export interface Playlist {
  playlist_id: number;
  name: string;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
  user_id: number;      
  image_path: string | null;
  description: string | null;
}

export interface PlaylistWithDetails extends Playlist {
  genres?: { genre_id: number; name: string }[];
  songs_count?: number;
  likes_count?: number;
  owner_username?: string;
}

export class PlaylistValidator {
  name: string;
  is_public: boolean;
  user_id: number;
  image_path: string | null;
  description: string | null;

  constructor(
    name: string,
    user_id: number,
    is_public: boolean = true,
    description: string | null = null,
    image_path: string | null = null
  ) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new HttpError(400, 'Playlist name is required');
    }

    if (name.trim().length > 255) {
      throw new HttpError(400, 'Playlist name must be at most 255 characters');
    }

    if (!user_id || typeof user_id !== 'number') {
      throw new HttpError(400, 'User ID is required');
    }

    if (typeof is_public !== 'boolean') {
      throw new HttpError(400, 'Visibility (is_public) must be true or false');
    }

    if (description !== null && typeof description !== 'string') {
      throw new HttpError(400, 'Description must be a string');
    }

    if (image_path !== null && typeof image_path !== 'string') {
      throw new HttpError(400, 'Image path must be a string');
    }

    this.name = name.trim();
    this.user_id = user_id;
    this.is_public = is_public;
    this.description = description ? description.trim() : null;
    this.image_path = image_path ? image_path.trim() : null;
  }
}

export class PlaylistUpdateValidator {
  name?: string;
  is_public?: boolean;
  description?: string | null;
  image_path?: string | null;

  constructor(data: {
    name?: string;
    is_public?: boolean;
    description?: string | null;
    image_path?: string | null;
  }) {
    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || data.name.trim().length === 0) {
        throw new HttpError(400, 'Playlist name cannot be empty');
      }
      if (data.name.trim().length > 255) {
        throw new HttpError(400, 'Playlist name must be at most 255 characters');
      }
      this.name = data.name.trim();
    }

    if (data.is_public !== undefined) {
      if (typeof data.is_public !== 'boolean') {
        throw new HttpError(400, 'Visibility (is_public) must be true or false');
      }
      this.is_public = data.is_public;
    }

    if (data.description !== undefined) {
      if (data.description !== null && typeof data.description !== 'string') {
        throw new HttpError(400, 'Description must be a string or null');
      }
      this.description = data.description ? data.description.trim() : null;
    }

    if (data.image_path !== undefined) {
      if (data.image_path !== null && typeof data.image_path !== 'string') {
        throw new HttpError(400, 'Image path must be a string or null');
      }
      this.image_path = data.image_path ? data.image_path.trim() : null;
    }
  }
}
