import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router'; 

import { Playlist } from '../../models/playlist';
import { UsersService } from '../../services/users';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './favorites.html',
  styleUrls: ['./favorites.scss']
})
export class FavoritesPage implements OnInit {
  favorites: Playlist[] = [];
  loading: boolean = true; 

  constructor(
    private usersService: UsersService,
    private authService: AuthService,
    private router: Router 
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      if (user?.user_id) {
        this.usersService.getFavorites(user.user_id).subscribe({
          next: (res: any) => {
            this.favorites = Array.isArray(res) ? res : (res.favorites || []);
            this.loading = false;
          },
          error: (err) => {
            console.error('Error loading favorites:', err);
            this.loading = false;
          }
        });
      } else {
        this.loading = false;
      }
    });
  }

  openPlaylist(id: number) {
    this.router.navigate(['/playlists', id]);
  }
}