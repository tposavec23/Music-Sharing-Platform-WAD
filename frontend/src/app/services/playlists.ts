import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs'; 
import { Playlist } from '../models/playlist';
import { Song } from '../models/song';

interface PlaylistsResponse {
  data: Playlist[];
  pagination: { total: number; limit: number; offset: number };
}

@Injectable({
  providedIn: 'root'
})
export class PlaylistsService {
  private apiUrl = '/api/playlists';

  constructor(private http: HttpClient) {}
  getGenres(): Observable<any[]> {
    return this.http.get<any[]>('/api/genres', { withCredentials: true });
  }
  getAll(filters?: { genre_id?: number; user_id?: number; search?: string }): Observable<Playlist[]> {
    let params = new HttpParams();
    if (filters?.genre_id) params = params.set('genre', filters.genre_id.toString());
    if (filters?.user_id) params = params.set('user_id', filters.user_id.toString());
    if (filters?.search) params = params.set('q', filters.search);
    
    params = params.set('t', new Date().getTime().toString());
    
    return this.http.get<PlaylistsResponse>(this.apiUrl, { params, withCredentials: true }).pipe(
      map(response => response.data)
    );
  }

  getOne(id: number): Observable<Playlist> {
    const t = new Date().getTime();
    return this.http.get<Playlist>(`${this.apiUrl}/${id}?t=${t}`, { withCredentials: true });
  }

  create(playlist: Partial<Playlist>): Observable<Playlist> {
    return this.http.post<Playlist>(this.apiUrl, playlist, { withCredentials: true });
  }

  update(id: number, playlist: Partial<Playlist>): Observable<Playlist> {
    return this.http.put<Playlist>(`${this.apiUrl}/${id}`, playlist, { withCredentials: true });
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  getSongs(playlistId: number): Observable<any> {
    const t = new Date().getTime();
    return this.http.get<any>(`${this.apiUrl}/${playlistId}/songs?t=${t}`, { withCredentials: true });
  }

  addSong(playlistId: number, song: Partial<Song>): Observable<Song> {
    return this.http.post<Song>(`${this.apiUrl}/${playlistId}/songs`, song, { withCredentials: true });
  }

  removeSong(playlistId: number, songId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${playlistId}/songs/${songId}`, { withCredentials: true });
  }

  recordClick(playlistId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${playlistId}/clicks`, {}, { withCredentials: true });
  }

  likePlaylist(playlistId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${playlistId}/likes`, {}, { withCredentials: true });
  }

  unlike(playlistId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${playlistId}/likes`, { withCredentials: true });
  }


  favoritePlaylist(playlistId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${playlistId}/favorites`, {}, { withCredentials: true });
  }

  removeFromFavorites(playlistId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${playlistId}/favorites`, { withCredentials: true });
  }

  getRecommendations(type?: string): Observable<Playlist[]> {
    const baseUrl = '/api/recommendations';
    const url = type ? `${baseUrl}/${type}` : baseUrl;
    const params = new HttpParams().set('t', new Date().getTime().toString());

    return this.http.get<any>(url, { params, withCredentials: true }).pipe(
      map(response => {
        return Array.isArray(response) ? response : (response.data || []);
      })
    );
  }
  getTopGenres(): Observable<any[]> {
    return this.http.get<any[]>('/api/recommendations/genres', { withCredentials: true }).pipe(
      map(genres => genres.map(g => ({ ...g, count: g.playlist_count || g.count || 0 })))
    );
  }

  getTrending(): Observable<Playlist[]> {
    return this.http.get<any>('/api/recommendations', { withCredentials: true }).pipe(
      map(res => res.trending || res.data || (Array.isArray(res) ? res : []))
    );
  }


  updateSong(playlistId: number, songId: number, data: Partial<Song>): Observable<any> {
    return this.http.put(`${this.apiUrl}/${playlistId}/songs/${songId}`, data, { withCredentials: true });
  }

  getLikeCount(playlistId: number): Observable<{ playlist_id: number; likes_count: number }> {
    return this.http.get<{ playlist_id: number; likes_count: number }>(
      `${this.apiUrl}/${playlistId}/likes/count`,
      { withCredentials: true }
    );
  }

  checkFavorited(playlistId: number): Observable<{ playlist_id: number; is_favorited: boolean; added_at: string | null }> {
    return this.http.get<{ playlist_id: number; is_favorited: boolean; added_at: string | null }>(
      `${this.apiUrl}/${playlistId}/favorites/check`,
      { withCredentials: true }
    );
  }

  getClickStats(playlistId: number): Observable<{
    playlist_id: number;
    total_clicks: number;
    clicks_per_day: { date: string; count: number }[];
  }> {
    return this.http.get<any>(`${this.apiUrl}/${playlistId}/clicks/stats`, { withCredentials: true });
  }

  uploadImage(file: File, playlistId: number): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', 'playlists');
    formData.append('name', `playlist_${playlistId}_${Date.now()}.${file.name.split('.').pop()}`);

    return this.http.post('/api/upload', formData, { withCredentials: true });
  }

  getSongMetadata(url: string): Observable<{
    title: string;
    artist: string;
    duration: number;
    thumbnail: string | null;
    platform: string;
  }> {
    const params = new HttpParams().set('url', url);
    return this.http.get<any>('/api/songs/metadata', { params, withCredentials: true });
  }
}