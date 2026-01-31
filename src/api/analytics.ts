import { Router, Request, Response, NextFunction } from 'express';
import { sysdb } from '../helpers/sysdb';
import { db } from '../helpers/db';
import { HttpError } from '../helpers/errors';
import { requireRole } from '../helpers/auth';
import { User, RoleType } from '../model/user';

export const analyticsRouter = Router();

interface AuthRequest extends Request {
  user?: User;
}

async function getUsername(userId: number): Promise<string | null> {
  const user = await sysdb.connection!.get('SELECT username FROM users WHERE user_id = ?', userId);
  return user?.username || null;
}

analyticsRouter.get('/', requireRole([RoleType.ADMINISTRATOR, RoleType.MANAGEMENT]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userStats = await sysdb.connection!.get(`
      SELECT
        COUNT(*) as total_users,
        SUM(CASE WHEN role_id = 0 THEN 1 ELSE 0 END) as admin_count,
        SUM(CASE WHEN role_id = 1 THEN 1 ELSE 0 END) as management_count,
        SUM(CASE WHEN role_id = 2 THEN 1 ELSE 0 END) as regular_user_count
      FROM users
    `);

    const playlistStats = await db.connection!.get(`
      SELECT
        COUNT(*) as total_playlists,
        SUM(CASE WHEN is_public = 1 THEN 1 ELSE 0 END) as public_playlists,
        SUM(CASE WHEN is_public = 0 THEN 1 ELSE 0 END) as private_playlists
      FROM playlists
    `);

    const songStats = await db.connection!.get(`
      SELECT
        COUNT(*) as total_songs,
        SUM(CASE WHEN platform = 'youtube' THEN 1 ELSE 0 END) as youtube_songs,
        SUM(CASE WHEN platform = 'spotify' THEN 1 ELSE 0 END) as spotify_songs
      FROM songs
    `);

    const genreStats = await db.connection!.get(`
      SELECT COUNT(*) as total_genres FROM genres
    `);

    const interactionStats = await db.connection!.get(`
      SELECT
        (SELECT COUNT(*) FROM playlist_likes) as total_likes,
        (SELECT COUNT(*) FROM playlist_favorites) as total_favorites,
        (SELECT COUNT(*) FROM playlist_clicks) as total_clicks
    `);

    const recentActivity = await db.connection!.get(`
      SELECT
        (SELECT COUNT(*) FROM playlists WHERE created_at > datetime('now', '-7 days')) as new_playlists_week,
        (SELECT COUNT(*) FROM playlist_likes WHERE liked_at > datetime('now', '-7 days')) as new_likes_week,
        (SELECT COUNT(*) FROM playlist_clicks WHERE clicked_at > datetime('now', '-7 days')) as clicks_week
    `);

    const topCreatorsRaw = await db.connection!.all(`
      SELECT
        p.user_id,
        COUNT(*) as playlist_count,
        SUM((SELECT COUNT(*) FROM playlist_likes pl WHERE pl.playlist_id = p.playlist_id)) as total_likes
      FROM playlists p
      WHERE p.is_public = 1
      GROUP BY p.user_id
      ORDER BY playlist_count DESC
      LIMIT 5
    `);

    const topCreators = await Promise.all(topCreatorsRaw.map(async (c: any) => ({
      user_id: c.user_id,
      username: await getUsername(c.user_id),
      playlist_count: c.playlist_count,
      total_likes: c.total_likes
    })));

    const popularPlaylistsRaw = await db.connection!.all(`
      SELECT
        p.playlist_id,
        p.name,
        p.user_id,
        (SELECT COUNT(*) FROM playlist_likes WHERE playlist_id = p.playlist_id) as likes_count,
        (SELECT COUNT(*) FROM playlist_clicks WHERE playlist_id = p.playlist_id) as clicks_count
      FROM playlists p
      WHERE p.is_public = 1
      ORDER BY likes_count DESC
      LIMIT 5
    `);

    const popularPlaylists = await Promise.all(popularPlaylistsRaw.map(async (p: any) => ({
      playlist_id: p.playlist_id,
      name: p.name,
      creator: await getUsername(p.user_id),
      likes_count: p.likes_count,
      clicks_count: p.clicks_count
    })));

    res.json({
      users: userStats,
      playlists: playlistStats,
      songs: songStats,
      genres: genreStats,
      interactions: interactionStats,
      recent_activity: recentActivity,
      top_creators: topCreators,
      popular_playlists: popularPlaylists
    });
  } catch (error) {
    next(error);
  }
});

