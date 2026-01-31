import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { PlaylistsService } from '../../services/playlists';
import { AuthService } from '../../services/auth';
import { Playlist } from '../../models/playlist';

Chart.register(...registerables);

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})
export class HomePage implements OnInit, AfterViewInit {
  @ViewChild('genreChart') genreChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('playlistChart') playlistChartRef!: ElementRef<HTMLCanvasElement>;

  trending: Playlist[] = [];
  newReleases: Playlist[] = [];
  topGenres: any[] = [];
  loading: boolean = true;
  private genreChart: Chart | null = null;
  private playlistChart: Chart | null = null;

  constructor(
    public authService: AuthService,
    private playlistsService: PlaylistsService,
    private router: Router
  ) {}

  ngOnInit() {
    this.fetchData();
  }

  ngAfterViewInit() {}

  onLibraryClick() {
    if (this.authService.currentUser && this.authService.currentUser.user_id) {
      this.router.navigate(['/my-playlists']);
    } else {
      this.router.navigate(['/login']);
    }
  }

  fetchData() {
    this.loading = true;

    this.playlistsService.getTrending().subscribe({
      next: (data: any[]) => {
        this.trending = data.slice(0, 5);
        this.loading = false;
        setTimeout(() => this.renderPlaylistChart(), 100);
      },
      error: (err) => {
        console.error('Trending Error:', err);
        this.loading = false;
      }
    });

    this.playlistsService.getRecommendations('new').subscribe({
      next: (data: Playlist[]) => this.newReleases = data.slice(0, 8),
      error: (err) => console.log('Could not load new releases', err)
    });

    this.playlistsService.getTopGenres().subscribe({
      next: (data) => {
        this.topGenres = data.sort((a: any, b: any) => (b.count || 0) - (a.count || 0)).slice(0, 5);
        this.calculateGenreWidths();
        setTimeout(() => this.renderGenreChart(), 100);
      },
      error: (err) => console.error('Genre Error:', err)
    });
  }

  renderGenreChart() {
    if (!this.genreChartRef || this.topGenres.length === 0) return;

    if (this.genreChart) {
      this.genreChart.destroy();
    }

    const ctx = this.genreChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const colors = [
      '#00e5ff',
      '#2979ff',
      '#00bfa5',
      '#ff4081',
      '#ffc107'
    ];

    this.genreChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: this.topGenres.map(g => g.name),
        datasets: [{
          data: this.topGenres.map(g => g.count || 0),
          backgroundColor: colors.slice(0, this.topGenres.length),
          borderColor: '#0a0e14',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#b0bec5',
              font: {
                family: 'Orbitron',
                size: 11
              },
              padding: 15
            }
          }
        }
      }
    });
  }

  renderPlaylistChart() {
    if (!this.playlistChartRef || this.trending.length === 0) return;

    if (this.playlistChart) {
      this.playlistChart.destroy();
    }

    const ctx = this.playlistChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const colors = [
      '#00e5ff',
      '#2979ff',
      '#00bfa5',
      '#ff4081',
      '#ffc107'
    ];

    const chartData = this.trending.map((p: any) => p.likes_count || 0);

    this.playlistChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.trending.map((p: any) => p.name),
        datasets: [{
          label: 'Likes',
          data: chartData,
          backgroundColor: colors,
          borderColor: '#0a0e14',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.1)' },
            ticks: { color: '#b0bec5' }
          },
          y: {
            grid: { display: false },
            ticks: {
              color: '#b0bec5',
              font: { family: 'Orbitron', size: 10 }
            }
          }
        }
      }
    });
  }

  calculateGenreWidths() {
    const max = Math.max(...this.topGenres.map(g => Number(g.count) || 0), 1);
    this.topGenres.forEach(g => {
      const val = Number(g.count) || 0;
      g.width = Math.max(Math.round((val / max) * 100), 5);
    });
  }
}
