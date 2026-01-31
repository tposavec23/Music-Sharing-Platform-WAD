import { HttpError } from "../helpers/errors";

export interface Genre {
  genre_id: number;
  name: string;
  created_at: Date;
  user_id: number; 
}

export class GenreValidator {
  name: string;
  user_id: number;

  constructor(name: string, user_id: number) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new HttpError(400, 'Genre name is required');
    }

    if (name.trim().length > 255) {
      throw new HttpError(400, 'Genre name must be at most 255 characters');
    }

    if (!user_id || typeof user_id !== 'number') {
      throw new HttpError(400, 'User ID is required');
    }

    this.name = name.trim();
    this.user_id = user_id;
  }
}

export const DEFAULT_GENRES = ['Rock', 'EDM', 'Hip-Hop', 'Chill', 'Workout', 'Pop', 'Jazz', 'Classical'];
