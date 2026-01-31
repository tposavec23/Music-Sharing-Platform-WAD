export interface Song {
  song_id: number;
  title: string;
  artist: string;
  duration: number;
  platform: 'youtube' | 'spotify';
  url: string;
  image_path?: string;
  added_at: Date;
}
