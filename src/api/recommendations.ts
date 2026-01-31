import { Router, Request, Response, NextFunction } from 'express';
import { sysdb } from '../helpers/sysdb';
import { db } from '../helpers/db';

export const recommendationsRouter = Router();

async function getUsername(userId: number): Promise<string | null> {
  const user = await sysdb.connection!.get('SELECT username FROM users WHERE user_id = ?', userId);
  return user?.username || null;
}

//Public trending playlists for unregistered or loged out users!!!
recommendationsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    // Get trending playlists based on recent clicks and likes
    const trending = await db.connection!.all(`
      SELECT
        p.playlist_id,
        p.name,
        p.description,
        p.image_path,
        p.created_at,
        p.user_id,
        (SELECT COUNT(*) FROM playlist_likes WHERE playlist_id = p.playlist_id) as likes_count,
        (SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = p.playlist_id) as songs_count,
        (SELECT COUNT(*) FROM playlist_clicks WHERE playlist_id = p.playlist_id
          AND clicked_at > datetime('now', '-7 days')) as recent_clicks,
        GROUP_CONCAT(DISTINCT g.name) as genres
      FROM playlists p
      LEFT JOIN playlist_genres pg ON p.playlist_id = pg.playlist_id
      LEFT JOIN genres g ON pg.genre_id = g.genre_id
      WHERE p.is_public = 1
      GROUP BY p.playlist_id
      ORDER BY recent_clicks DESC, likes_count DESC
      LIMIT ?
    `, limit);

    const formattedTrending = await Promise.all(trending.map(async (p: any) => ({
      playlist_id: p.playlist_id,
      name: p.name,
      description: p.description,
      image_path: p.image_path,
      created_at: p.created_at,
      creator: await getUsername(p.user_id),
      likes_count: p.likes_count,
      songs_count: p.songs_count,
      recent_clicks: p.recent_clicks,
      genres: p.genres ? p.genres.split(',') : []
    })));

    res.json({
      trending: formattedTrending,
      period: 'last_7_days'
    });
  } catch (error) {
    next(error);
  }
});

//Popular genres
recommendationsRouter.get('/genres', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const popularGenres = await db.connection!.all(`
      SELECT
        g.genre_id,
        g.name,
        COUNT(DISTINCT pg.playlist_id) as playlist_count,
        SUM((SELECT COUNT(*) FROM playlist_likes pl WHERE pl.playlist_id = pg.playlist_id)) as total_likes
      FROM genres g
      LEFT JOIN playlist_genres pg ON g.genre_id = pg.genre_id
      LEFT JOIN playlists p ON pg.playlist_id = p.playlist_id AND p.is_public = 1
      GROUP BY g.genre_id
      HAVING playlist_count > 0
      ORDER BY playlist_count DESC, total_likes DESC
      LIMIT 10
    `);

    res.json(popularGenres);
  } catch (error) {
    next(error);
  }
});

//Recently created public playlists
recommendationsRouter.get('/new', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const newPlaylists = await db.connection!.all(`
      SELECT
        p.playlist_id,
        p.name,
        p.description,
        p.image_path,
        p.created_at,
        p.user_id,
        (SELECT COUNT(*) FROM playlist_likes WHERE playlist_id = p.playlist_id) as likes_count,
        (SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = p.playlist_id) as songs_count,
        GROUP_CONCAT(DISTINCT g.name) as genres
      FROM playlists p
      LEFT JOIN playlist_genres pg ON p.playlist_id = pg.playlist_id
      LEFT JOIN genres g ON pg.genre_id = g.genre_id
      WHERE p.is_public = 1
      GROUP BY p.playlist_id
      ORDER BY p.created_at DESC
      LIMIT ?
    `, limit);

    const formatted = await Promise.all(newPlaylists.map(async (p: any) => ({
      playlist_id: p.playlist_id,
      name: p.name,
      description: p.description,
      image_path: p.image_path,
      created_at: p.created_at,
      creator: await getUsername(p.user_id),
      likes_count: p.likes_count,
      songs_count: p.songs_count,
      genres: p.genres ? p.genres.split(',') : []
    })));

    res.json(formatted);
  } catch (error) {
    next(error);
  }
});
