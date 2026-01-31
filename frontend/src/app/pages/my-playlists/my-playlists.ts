import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { Playlist } from '../../models/playlist';
import { PlaylistsService } from '../../services/playlists';
import { AuthService } from '../../services/auth';
import { User } from '../../models/user';

@Component({
  selector: 'app-my-playlists',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './my-playlists.html',
  styleUrls: ['./my-playlists.scss']
})
export class MyPlaylistsPage implements OnInit {
  playlists: Playlist[] = [];
  user: User | null = null;
  loading: boolean = true;

  isCreateFormVisible = false;
  
  genres: any[] = []; 

  newPlaylistData = {
    name: '',
    description: '',
    is_public: true,
    genre_id: 1
  };

  selectedGenreName = '';
  selectedImage: File | null = null;
  imagePreview: string | null = null;

  constructor(
    private playlistsService: PlaylistsService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.user = user;
      if (user?.user_id) {
        this.loadPlaylists(user.user_id);
      }
    });

    this.playlistsService.getGenres().subscribe({
      next: (data) => {
        this.genres = data;

        if (this.genres.length > 0) {
          const firstId = this.genres[0].genre_id || this.genres[0].id;
          this.newPlaylistData.genre_id = firstId;
          this.selectedGenreName = this.genres[0].name;
        }
      },
      error: (err) => console.error('Could not load genres', err)
    });
  }

  loadPlaylists(userId: number) {
    this.loading = true;
    this.playlistsService.getAll({ user_id: userId }).subscribe({
      next: (p) => {
        this.playlists = p.sort((a, b) => b.playlist_id - a.playlist_id);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading playlists:', err);
        this.loading = false;
      }
    });
  }

  getGenreName(id: number): string {
    if (!this.genres || this.genres.length === 0) return 'Loading...';

    const found = this.genres.find(g => (g.genre_id || g.id) === id);
    return found ? found.name : 'Unknown';
  }

  onGenreChange() {
    const currentId = Number(this.newPlaylistData.genre_id);
    const found = this.genres.find(g => (g.genre_id || g.id) === currentId);
    this.selectedGenreName = found ? found.name : '';
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedImage = input.files[0];

      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(this.selectedImage);
    }
  }

  clearImage() {
    this.selectedImage = null;
    this.imagePreview = null;
  }

  deletePlaylist(event: Event, id: number) {
    event.stopPropagation();
    event.preventDefault();

    if (confirm('Are you sure you want to delete this playlist?')) {
      this.playlistsService.delete(id).subscribe({
        next: () => {
          this.playlists = this.playlists.filter(p => p.playlist_id !== id);
        },
        error: (err) => alert('Error deleting: ' + (err.error?.message || err.message))
      });
    }
  }

  editPlaylist(event: Event, playlist: any) {
    event.stopPropagation();
    event.preventDefault();

    const newName = prompt('Enter new name:', playlist.name);
    
    if (newName && newName !== playlist.name) {
      this.playlistsService.update(playlist.playlist_id, { name: newName }).subscribe({
        next: () => {
          playlist.name = newName;
        },
        error: (err) => alert('Error updating: ' + (err.error?.message || err.message))
      });
    }
  }

  toggleCreateForm() {
    this.isCreateFormVisible = !this.isCreateFormVisible;

    if (this.isCreateFormVisible && this.genres.length > 0) {
      const currentId = Number(this.newPlaylistData.genre_id);
      const found = this.genres.find(g => (g.genre_id || g.id) === currentId);
      this.selectedGenreName = found ? found.name : this.genres[0].name;
    }
  }

  submitCreate() {
    if (!this.newPlaylistData.name) {
      alert('Please enter a name!');
      return;
    }

    // Backend expects genre_ids as array of numbers
    const genreId = Number(this.newPlaylistData.genre_id);
    const payload = {
      name: this.newPlaylistData.name,
      description: this.newPlaylistData.description,
      is_public: this.newPlaylistData.is_public,
      genre_ids: [genreId]
    };

    const currentGenreName = this.selectedGenreName;
    const imageFile = this.selectedImage;

    this.playlistsService.create(payload).subscribe({
      next: (createdPlaylist: any) => {
        const playlistId = createdPlaylist.playlist_id;

        // If there's an image, upload it and update the playlist
        if (imageFile) {
          this.playlistsService.uploadImage(imageFile, playlistId).subscribe({
            next: (uploadResult: any) => {
              const imagePath = uploadResult.file?.savedAs || null;

              if (imagePath) {
                this.playlistsService.update(playlistId, { image_path: imagePath }).subscribe({
                  next: () => {
                    this.finalizeCreate(createdPlaylist, currentGenreName, genreId, imagePath);
                  },
                  error: () => {
                    this.finalizeCreate(createdPlaylist, currentGenreName, genreId, null);
                  }
                });
              } else {
                this.finalizeCreate(createdPlaylist, currentGenreName, genreId, null);
              }
            },
            error: () => {
              this.finalizeCreate(createdPlaylist, currentGenreName, genreId, null);
            }
          });
        } else {
          this.finalizeCreate(createdPlaylist, currentGenreName, genreId, null);
        }
      },
      error: (err) => {
        console.error(err);
        alert('Error: ' + (err.error?.message || 'Something went wrong'));
      }
    });
  }

  private finalizeCreate(createdPlaylist: any, genreName: string, genreId: number, imagePath: string | null) {
    this.isCreateFormVisible = false;

    this.newPlaylistData = {
      name: '',
      description: '',
      is_public: true,
      genre_id: genreId
    };
    this.selectedImage = null;
    this.imagePreview = null;

    this.router.navigate(['/playlists', createdPlaylist.playlist_id]);
  }
}