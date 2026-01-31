import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; 

import { Playlist } from '../../models/playlist';
import { PlaylistsService } from '../../services/playlists';
import { AuthService } from '../../services/auth'; 

@Component({
  selector: 'app-playlists',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './playlists.html',
  styleUrls: ['./playlists.scss']
})
export class PlaylistsPage implements OnInit {
  playlists: Playlist[] = [];
  searchTerm: string = '';
  selectedGenre: number | null = null;
  loading: boolean = true;
  sortBy: string = 'newest'; 

  showCreateModal = false;
  genres: any[] = [];
  //test
  
  newPlaylist = { 
    name: '', 
    description: '', 
    is_public: true, 
    genre_id: 1 
  };

  constructor(
    private playlistsService: PlaylistsService,
    public authService: AuthService, 
    private router: Router
  ) {}

  ngOnInit() {
    this.playlistsService.getGenres().subscribe({
      next: (data) => {
        this.genres = data;
        if (this.genres.length > 0) {
           const firstId = this.genres[0].genre_id || this.genres[0].id;
           this.newPlaylist.genre_id = firstId;
        }
        this.loadAll();
      },
      error: (err) => {
        console.error('Could not load genres', err);
        this.loadAll();
      }
    });
  }

  loadAll() {
    this.loading = true;
    this.playlistsService.getAll({
      search: this.searchTerm || undefined,
      genre_id: this.selectedGenre || undefined
    }).subscribe({
      next: (data) => {
        this.playlists = data;
        this.applySort();
        this.loading = false;
      },
      error: (err) => {
        console.error('Catalog load failed', err);
        this.loading = false;
      }
    });
  }

  onFilterChange() { this.loadAll(); }
  onSortChange() { this.applySort(); }

  applySort() {
    if (!this.playlists) return;

    this.playlists.sort((a: any, b: any) => {
      switch (this.sortBy) {
        case 'newest':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case 'oldest':
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        case 'az':
          return (a.name || '').localeCompare(b.name || '');
        case 'za':
          return (b.name || '').localeCompare(a.name || '');
        case 'likes':
          return (b.likes_count || 0) - (a.likes_count || 0);
        default:
          return 0;
      }
    });
  }

  getGenreLabel(playlist: any): string {
    if (this.selectedGenre && !playlist.genre_id) {
       const current = this.genres.find(g => (g.genre_id || g.id) == this.selectedGenre);
       if (current) return current.name;
    }
    if (playlist.genre_id) {
      const found = this.genres.find(g => (g.genre_id || g.id) == playlist.genre_id);
      if (found) return found.name;
    }
    if (playlist.genres) return playlist.genres;

    return 'Unknown';
  }

  viewDetail(id: number) {
    this.router.navigate(['/playlists', id]);
  }

  openCreateModal() { this.showCreateModal = true; }
  closeModal() { this.showCreateModal = false; }

  createPlaylist() {
    if (!this.newPlaylist.name) return;
    
    this.playlistsService.create(this.newPlaylist).subscribe({
      next: (created) => {
        this.playlists.unshift(created); 
        this.closeModal();
        const currentGenreId = this.newPlaylist.genre_id;
        this.newPlaylist = { 
          name: '', 
          description: '', 
          is_public: true, 
          genre_id: currentGenreId 
        }; 
        this.applySort(); 
      },
      error: (err) => alert('Failed to create playlist.')
    });
  }
}