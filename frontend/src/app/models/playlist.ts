export interface Playlist {
  playlist_id: number;
  name: string;
  description?: string;
  is_public: boolean;
  image_path?: string;
  user_id: number;
  owner_username?: string;
  creator?: string;
  created_at: Date;
  updated_at: Date;
  likes_count?: number;
  songs_count?: number;
  genre_id: number;
  genres?: string;
  width?: number;
  clicks?: number;
}