import { Route } from '@angular/router';
import { HomePage } from './pages/home/home';
import { PlaylistsPage } from './pages/playlists/playlists';
import { PlaylistDetailPage } from './pages/playlist-detail/playlist-detail';
import { MyPlaylistsPage } from './pages/my-playlists/my-playlists';
import { FavoritesPage } from './pages/favorites/favorites';
import { GenresPage } from './pages/genres/genres';
import { UsersPage } from './pages/users/users';
import { AuditLogPage } from './pages/audit-log/audit-log';
import { InfoPage } from './pages/info/info';
import { authGuard } from './guards/auth.guard';

export interface AppRoute extends Route {
  data?: { roles?: number[] };
}

export const routes: AppRoute[] = [
  { path: '', component: HomePage, title: 'Home' },
  { path: 'playlists', component: PlaylistsPage, title: 'Playlists' },
  { path: 'playlists/:id', component: PlaylistDetailPage, title: 'Playlist' },
  {
    path: 'my-playlists',
    component: MyPlaylistsPage,
    title: 'My Playlists',
    canActivate: [authGuard],
    data: { roles: [0, 2] }
  },
  {
    path: 'favorites',
    component: FavoritesPage,
    title: 'Favorites',
    canActivate: [authGuard],
    data: { roles: [0, 1, 2] }
  },
  {
    path: 'genres',
    component: GenresPage,
    title: 'Genres',
    canActivate: [authGuard],
    data: { roles: [1] }
  },
  {
    path: 'users',
    component: UsersPage,
    title: 'Users',
    canActivate: [authGuard],
    data: { roles: [0] }
  },
  {
    path: 'audit-log',
    component: AuditLogPage,
    title: 'Audit Log',
    canActivate: [authGuard],
    data: { roles: [0] }
  },
  { path: 'info', component: InfoPage, title: 'Info' }
];
