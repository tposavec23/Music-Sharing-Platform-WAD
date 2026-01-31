import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { PlaylistsService } from '../../services/playlists';
import { AuthService } from '../../services/auth';
import { LoginDialog } from '../../dialogs/login/login';
import { Playlist } from '../../models/playlist';
import { Song } from '../../models/song';



@Component({

  selector: 'app-playlist-detail',

  standalone: true,

  imports: [CommonModule, FormsModule],

  templateUrl: './playlist-detail.html',

  styleUrls: ['./playlist-detail.scss']

})

export class PlaylistDetailPage implements OnInit {

  playlist: Playlist | null = null;

  songs: Song[] = [];

  searchTerm: string = '';



  isLiked = false;
  isFavorited = false;

  title = '';
  artist = '';
  url = '';
  duration = 0;
  loadingMetadata = false;



  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private playlistsService: PlaylistsService,
    public authService: AuthService,
    private dialog: MatDialog
  ) {}



  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.loadPlaylist(id);
      this.loadSongs(id);
    }
  }



  get filteredSongs(): Song[] {

    if (!this.searchTerm) return this.songs;

    const q = this.searchTerm.toLowerCase();

    return this.songs.filter(s =>

      s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)

    );

  }



  loadPlaylist(id: number) {
    this.playlistsService.getOne(id).subscribe({
      next: (p: any) => {
        this.playlist = p;
        this.isLiked = !!p.user_liked;
        this.isFavorited = !!p.user_favorited;
      },
      error: () => this.goBack()
    });
  }



  loadSongs(id: number) {

    this.playlistsService.getSongs(id).subscribe({

      next: (res: any) => {

        const raw = res.songs || (Array.isArray(res) ? res : []);

        this.songs = raw.sort((a: any, b: any) => a.song_id - b.song_id);

      }

    });

  }



  openSong(url: string) {

    if (!url) return;

    const safeUrl = url.startsWith('http') ? url : `https://${url}`;

    window.open(safeUrl, '_blank');

  }



  playFirst() {
    if (this.filteredSongs.length > 0) {
      this.openSong(this.filteredSongs[0].url);
    }
  }

  onUrlChange() {
    setTimeout(() => this.fetchMetadata(), 100);
  }

  private fetchMetadata() {
    if (!this.url || this.url.length < 10) return;

    const isYouTube = /youtube\.com|youtu\.be/.test(this.url);
    const isSpotify = /spotify\.com/.test(this.url);

    if (!isYouTube && !isSpotify) return;

    this.playlistsService.getSongMetadata(this.url).subscribe({
      next: (data) => {
        this.title = data.title;
        this.artist = data.artist;
        this.duration = data.duration;
      },
      error: (err) => {
        if (isSpotify) {
          alert('Spotify metadata nije dostupan. Unesi title i artist ručno.');
        }
      }
    });
  }

  toggleLike() {
    if (!this.playlist) return;

    if (!this.authService.currentUser) {
      this.openLoginDialog('like');
      return;
    }

    const wasLiked = this.isLiked;
    this.isLiked = !this.isLiked;

    const request$ = this.isLiked
      ? this.playlistsService.likePlaylist(this.playlist.playlist_id)
      : this.playlistsService.unlike(this.playlist.playlist_id);

    request$.subscribe({
      next: () => console.log('Like status updated in DB'),
      error: (err) => {
        console.error('Like failed', err);
        this.isLiked = wasLiked;
      }
    });
  }

  toggleFavorite() {
    if (!this.playlist) return;

    if (!this.authService.currentUser) {
      this.openLoginDialog('favorite');
      return;
    }

    const wasFavorited = this.isFavorited;
    this.isFavorited = !this.isFavorited;

    const request$ = this.isFavorited
      ? this.playlistsService.favoritePlaylist(this.playlist.playlist_id)
      : this.playlistsService.removeFromFavorites(this.playlist.playlist_id);

    request$.subscribe({
      next: () => console.log('Favorite status updated in DB'),
      error: (err) => {
        console.error('Favorite failed', err);
        this.isFavorited = wasFavorited;
      }
    });
  }

  private pendingAction: 'like' | 'favorite' | null = null;

  openLoginDialog(action: 'like' | 'favorite') {
    this.pendingAction = action;
    const dialogRef = this.dialog.open(LoginDialog, {
      width: '400px',
      panelClass: 'custom-dialog-container'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'success' && this.pendingAction) {
        if (this.pendingAction === 'like') {
          this.toggleLike();
        } else if (this.pendingAction === 'favorite') {
          this.toggleFavorite();
        }
      }
      this.pendingAction = null;
    });
  }



  addSong() {
    if (!this.playlist || !this.title) return;

    const song = {
      title: this.title,
      artist: this.artist,
      url: this.url,
      duration: this.duration
    };

    this.playlistsService.addSong(this.playlist.playlist_id, song).subscribe({
      next: () => {
        this.loadSongs(this.playlist!.playlist_id);
        this.title = '';
        this.artist = '';
        this.url = '';
        this.duration = 0;
      },
      error: (err) => {
        console.error('Failed to add song:', err);
        alert(err.error?.message || 'Failed to add song');
      }
    });
  }



  deleteSong(songId: number) {

    if (!this.playlist || !confirm('Remove song from playlist?')) return;

    this.playlistsService.removeSong(this.playlist.playlist_id, songId).subscribe({

      next: () => this.songs = this.songs.filter(s => s.song_id !== songId)

    });

  }



  canEdit() {

    return this.authService.currentUser?.role_id === 0 ||

           this.authService.currentUser?.user_id === this.playlist?.user_id;

  }



  goBack() { this.router.navigate(['/playlists']); }

 

  formatDuration(s: any): string {

    const sec = Math.floor(Number(s) || 0);

    const mins = Math.floor(sec / 60);

    const remainingSecs = sec % 60;

    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;

  }

}