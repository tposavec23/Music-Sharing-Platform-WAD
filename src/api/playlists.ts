import { Router, Request, Response, NextFunction } from 'express';
import { sysdb } from '../helpers/sysdb';
import { db, logAudit } from '../helpers/db';
import { HttpError } from '../helpers/errors';
import { requireRole, requireAuth } from '../helpers/auth';
import { User, RoleType } from '../model/user';
import { PlaylistValidator, PlaylistUpdateValidator } from '../model/playlist';
import { SongValidator, SongUpdateValidator } from '../model/song';
import { AuditAction } from '../model/audit';

export const playlistsRouter = Router();

interface AuthRequest extends Request {
  user?: User;
}

async function getUsername(userId: number): Promise<string | null> {
  const user = await sysdb.connection!.get('SELECT username FROM users WHERE user_id = ?', userId);
  return user?.username || null;
}

async function isPlaylistOwner(playlistId: number, userId: number): Promise<boolean> {
  const playlist = await db.connection!.get(
    'SELECT user_id FROM playlists WHERE playlist_id = ?',
    playlistId
  );
  return playlist?.user_id === userId;
}

async function getPlaylistOrFail(playlistId: number) {
  const playlist = await db.connection!.get('SELECT * FROM playlists WHERE playlist_id = ?', playlistId);
  if (!playlist) {
    throw new HttpError(404, 'Playlist not found');
  }
  return playlist;
}

//List playlists with filtering
playlistsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const { genre, sort, order, limit, offset, q, user_id, is_public } = req.query;

    let whereClause = '1=1';
    const params: any[] = [];

    if (is_public !== undefined) {
      whereClause += ' AND p.is_public = ?';
      params.push(is_public === 'true' ? 1 : 0);
    } else if (!authReq.user || authReq.user.role_id === RoleType.UNREGISTERED) {
      whereClause += ' AND p.is_public = 1';
    }

    if (genre) {
      whereClause += ' AND p.playlist_id IN (SELECT playlist_id FROM playlist_genres WHERE genre_id = ?)';
      params.push(parseInt(genre as string));
    }

    if (user_id) {
      whereClause += ' AND p.user_id = ?';
      params.push(parseInt(user_id as string));
    }

    if (q) {
      whereClause += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }

    //Sorting
    let orderClause = 'p.created_at DESC';
    if (sort === 'likes') {
      orderClause = 'likes_count ' + (order === 'asc' ? 'ASC' : 'DESC');
    } else if (sort === 'name') {
      orderClause = 'p.name ' + (order === 'asc' ? 'ASC' : 'DESC');
    } else if (sort === 'created_at') {
      orderClause = 'p.created_at ' + (order === 'asc' ? 'ASC' : 'DESC');
    }

    // Pagination
    const limitNum = Math.min(parseInt(limit as string) || 10, 100);
    const offsetNum = parseInt(offset as string) || 0;

    const playlistsRaw = await db.connection!.all(`
      SELECT p.*,
        (SELECT COUNT(*) FROM playlist_likes WHERE playlist_id = p.playlist_id) as likes_count,
        (SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = p.playlist_id) as songs_count,
        (SELECT GROUP_CONCAT(g.name) FROM playlist_genres pg JOIN genres g ON pg.genre_id = g.genre_id WHERE pg.playlist_id = p.playlist_id) as genres
      FROM playlists p
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `, ...params, limitNum, offsetNum);

    const countResult = await db.connection!.get(`
      SELECT COUNT(*) as total FROM playlists p WHERE ${whereClause}
    `, ...params);

    const playlists = await Promise.all(playlistsRaw.map(async (p: any) => ({
      ...p,
      owner_username: await getUsername(p.user_id),
      genres: p.genres ? p.genres.split(',') : []
    })));

    res.json({
      data: playlists,
      pagination: {
        total: countResult.total,
        limit: limitNum,
        offset: offsetNum
      }
    });
  } catch (error) {
    next(error);
  }
});

//Create Playlist
playlistsRouter.post('/', requireRole([RoleType.REGULAR_USER, RoleType.ADMINISTRATOR]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const { name, description, is_public, genre_ids } = req.body;

    const validator = new PlaylistValidator(
      name,
      authReq.user!.user_id,
      is_public ?? true,
      description
    );

    const result = await db.connection!.run(
      'INSERT INTO playlists (name, is_public, user_id, description) VALUES (?, ?, ?, ?)',
      validator.name,
      validator.is_public ? 1 : 0,
      validator.user_id,
      validator.description
    );

    const playlistId = result.lastID!;

    if (genre_ids && Array.isArray(genre_ids)) {
      for (const genreId of genre_ids) {
        await db.connection!.run(
          'INSERT OR IGNORE INTO playlist_genres (playlist_id, genre_id) VALUES (?, ?)',
          playlistId, genreId
        );
      }
    }

    await logAudit(AuditAction.PLAYLIST_CREATED, playlistId, authReq.user?.user_id || null);

    res.status(201).json({
      message: 'Playlist created successfully',
      playlist_id: playlistId,
      name: validator.name,
      is_public: validator.is_public
    });
  } catch (error) {
    next(error);
  }
});

//Get single playlist
playlistsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playlistId = parseInt(req.params.id);
    const authReq = req as AuthRequest;

    if (isNaN(playlistId)) {
      throw new HttpError(400, 'Invalid playlist ID');
    }

    const playlistRaw = await db.connection!.get(`
      SELECT p.*,
        (SELECT COUNT(*) FROM playlist_likes WHERE playlist_id = p.playlist_id) as likes_count,
        (SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = p.playlist_id) as songs_count
      FROM playlists p
      WHERE p.playlist_id = ?
    `, playlistId);

    if (!playlistRaw) {
      throw new HttpError(404, 'Playlist not found');
    }

    const playlist = {
      ...playlistRaw,
      owner_username: await getUsername(playlistRaw.user_id)
    };

    if (!playlist.is_public) {
      if (!authReq.user || (authReq.user.user_id !== playlist.user_id && authReq.user.role_id !== RoleType.ADMINISTRATOR)) {
        throw new HttpError(403, 'This playlist is private');
      }
    }

    const genres = await db.connection!.all(`
      SELECT g.genre_id, g.name
      FROM playlist_genres pg
      JOIN genres g ON pg.genre_id = g.genre_id
      WHERE pg.playlist_id = ?
    `, playlistId);

    let userLiked = false;
    let userFavorited = false;
    if (authReq.user) {
      const liked = await db.connection!.get(
        'SELECT 1 FROM playlist_likes WHERE playlist_id = ? AND user_id = ?',
        playlistId, authReq.user.user_id
      );
      userLiked = !!liked;

      const favorited = await db.connection!.get(
        'SELECT 1 FROM playlist_favorites WHERE playlist_id = ? AND user_id = ?',
        playlistId, authReq.user.user_id
      );
      userFavorited = !!favorited;
    }

    res.json({
      ...playlist,
      genres,
      user_liked: userLiked,
      user_favorited: userFavorited
    });
  } catch (error) {
    next(error);
  }
});

// Update playlist (Owner only)
playlistsRouter.put('/:id', requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playlistId = parseInt(req.params.id);
    const authReq = req as AuthRequest;

    if (isNaN(playlistId)) {
      throw new HttpError(400, 'Invalid playlist ID');
    }

    const playlist = await getPlaylistOrFail(playlistId);

    if (playlist.user_id !== authReq.user!.user_id && authReq.user!.role_id !== RoleType.ADMINISTRATOR) {
      throw new HttpError(403, 'You can only update your own playlists');
    }

    const { name, description, is_public, genre_ids, image_path } = req.body;
    const validator = new PlaylistUpdateValidator({ name, description, is_public });

    const updates: string[] = [];
    const values: any[] = [];

    if (validator.name !== undefined) {
      updates.push('name = ?');
      values.push(validator.name);
    }
    if (validator.description !== undefined) {
      updates.push('description = ?');
      values.push(validator.description);
    }
    if (validator.is_public !== undefined) {
      updates.push('is_public = ?');
      values.push(validator.is_public ? 1 : 0);

      if (validator.is_public && !playlist.is_public) {
        await logAudit(AuditAction.PLAYLIST_PUBLISHED, playlistId, authReq.user?.user_id || null);
      } else if (!validator.is_public && playlist.is_public) {
        await logAudit(AuditAction.PLAYLIST_UNPUBLISHED, playlistId, authReq.user?.user_id || null);
      }
    }
    if (image_path !== undefined) {
      updates.push('image_path = ?');
      values.push(image_path);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(playlistId);
      await db.connection!.run(
        `UPDATE playlists SET ${updates.join(', ')} WHERE playlist_id = ?`,
        ...values
      );
    }

    if (genre_ids !== undefined && Array.isArray(genre_ids)) {
      await db.connection!.run('DELETE FROM playlist_genres WHERE playlist_id = ?', playlistId);
      for (const genreId of genre_ids) {
        await db.connection!.run(
          'INSERT OR IGNORE INTO playlist_genres (playlist_id, genre_id) VALUES (?, ?)',
          playlistId, genreId
        );
      }
    }

    await logAudit(AuditAction.PLAYLIST_UPDATED, playlistId, authReq.user?.user_id || null);

    res.json({ message: 'Playlist updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Delete playlist (Owner only)
playlistsRouter.delete('/:id', requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playlistId = parseInt(req.params.id);
    const authReq = req as AuthRequest;

    if (isNaN(playlistId)) {
      throw new HttpError(400, 'Invalid playlist ID');
    }

    const playlist = await getPlaylistOrFail(playlistId);

    if (playlist.user_id !== authReq.user!.user_id && authReq.user!.role_id !== RoleType.ADMINISTRATOR) {
      throw new HttpError(403, 'You can only delete your own playlists');
    }

    await db.connection!.run('DELETE FROM playlist_songs WHERE playlist_id = ?', playlistId);
    await db.connection!.run('DELETE FROM playlist_genres WHERE playlist_id = ?', playlistId);
    await db.connection!.run('DELETE FROM playlist_likes WHERE playlist_id = ?', playlistId);
    await db.connection!.run('DELETE FROM playlist_favorites WHERE playlist_id = ?', playlistId);
    await db.connection!.run('DELETE FROM playlist_clicks WHERE playlist_id = ?', playlistId);

    await db.connection!.run('DELETE FROM playlists WHERE playlist_id = ?', playlistId);

    await logAudit(AuditAction.PLAYLIST_DELETED, playlistId, authReq.user?.user_id || null);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});


//SONGS IN PLAYLIST!!

//Get songs in playlist
playlistsRouter.get('/:id/songs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playlistId = parseInt(req.params.id);
    const authReq = req as AuthRequest;

    if (isNaN(playlistId)) {
      throw new HttpError(400, 'Invalid playlist ID');
    }

    const playlist = await getPlaylistOrFail(playlistId);

    if (!playlist.is_public) {
      if (!authReq.user || (authReq.user.user_id !== playlist.user_id && authReq.user.role_id !== RoleType.ADMINISTRATOR)) {
        throw new HttpError(403, 'This playlist is private');
      }
    }

    // Unregistered users can only see first 10 songs
    let limitClause = '';
    if (!authReq.user || authReq.user.role_id === RoleType.UNREGISTERED) {
      limitClause = 'LIMIT 10';
    }

    const songs = await db.connection!.all(`
      SELECT s.*
      FROM playlist_songs ps
      JOIN songs s ON ps.song_id = s.song_id
      WHERE ps.playlist_id = ?
      ORDER BY s.added_at DESC
      ${limitClause}
    `, playlistId);

    const totalCount = await db.connection!.get(
      'SELECT COUNT(*) as count FROM playlist_songs WHERE playlist_id = ?',
      playlistId
    );

    res.json({
      songs,
      total: totalCount.count,
      limited: limitClause !== ''
    });
  } catch (error) {
    next(error);
  }
});

//Add song to playlist
playlistsRouter.post('/:id/songs', requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playlistId = parseInt(req.params.id);
    const authReq = req as AuthRequest;

    if (isNaN(playlistId)) {
      throw new HttpError(400, 'Invalid playlist ID');
    }

    const playlist = await getPlaylistOrFail(playlistId);

    if (playlist.user_id !== authReq.user!.user_id && authReq.user!.role_id !== RoleType.ADMINISTRATOR) {
      throw new HttpError(403, 'You can only add songs to your own playlists');
    }

    const { title, artist, url, duration, image_path } = req.body;

    const validator = new SongValidator(title, artist, url, duration, image_path);

    let song = await db.connection!.get('SELECT * FROM songs WHERE url = ?', validator.url);

    if (!song) {
      const result = await db.connection!.run(
        'INSERT INTO songs (title, artist, duration, platform, url, image_path) VALUES (?, ?, ?, ?, ?, ?)',
        validator.title,
        validator.artist,
        validator.duration,
        validator.platform,
        validator.url,
        validator.image_path
      );
      song = { song_id: result.lastID };
    }

    const existing = await db.connection!.get(
      'SELECT 1 FROM playlist_songs WHERE playlist_id = ? AND song_id = ?',
      playlistId, song.song_id
    );
    if (existing) {
      throw new HttpError(409, 'Song already in playlist');
    }

    await db.connection!.run(
      'INSERT INTO playlist_songs (playlist_id, song_id) VALUES (?, ?)',
      playlistId, song.song_id
    );

    await db.connection!.run(
      'UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE playlist_id = ?',
      playlistId
    );

    await logAudit(AuditAction.SONG_ADDED, song.song_id, authReq.user?.user_id || null);

    res.status(201).json({
      message: 'Song added to playlist',
      song_id: song.song_id
    });
  } catch (error) {
    next(error);
  }
});

//Get single song from playlist
playlistsRouter.get('/:id/songs/:songId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playlistId = parseInt(req.params.id);
    const songId = parseInt(req.params.songId);

    if (isNaN(playlistId) || isNaN(songId)) {
      throw new HttpError(400, 'Invalid ID');
    }

    await getPlaylistOrFail(playlistId);

    const song = await db.connection!.get(`
      SELECT s.*
      FROM playlist_songs ps
      JOIN songs s ON ps.song_id = s.song_id
      WHERE ps.playlist_id = ? AND ps.song_id = ?
    `, playlistId, songId);

    if (!song) {
      throw new HttpError(404, 'Song not found in playlist');
    }

    res.json(song);
  } catch (error) {
    next(error);
  }
});

//Update song in playlist
playlistsRouter.put('/:id/songs/:songId', requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playlistId = parseInt(req.params.id);
    const songId = parseInt(req.params.songId);
    const authReq = req as AuthRequest;

    if (isNaN(playlistId) || isNaN(songId)) {
      throw new HttpError(400, 'Invalid ID');
    }

    const playlist = await getPlaylistOrFail(playlistId);

    if (playlist.user_id !== authReq.user!.user_id && authReq.user!.role_id !== RoleType.ADMINISTRATOR) {
      throw new HttpError(403, 'You can only update songs in your own playlists');
    }

    const inPlaylist = await db.connection!.get(
      'SELECT 1 FROM playlist_songs WHERE playlist_id = ? AND song_id = ?',
      playlistId, songId
    );
    if (!inPlaylist) {
      throw new HttpError(404, 'Song not found in playlist');
    }

    const validator = new SongUpdateValidator(req.body);

    const updates: string[] = [];
    const values: any[] = [];

    if (validator.title !== undefined) {
      updates.push('title = ?');
      values.push(validator.title);
    }
    if (validator.artist !== undefined) {
      updates.push('artist = ?');
      values.push(validator.artist);
    }
    if (validator.url !== undefined) {
      updates.push('url = ?');
      updates.push('platform = ?');
      values.push(validator.url);
      values.push(validator.platform);
    }
    if (validator.duration !== undefined) {
      updates.push('duration = ?');
      values.push(validator.duration);
    }
    if (validator.image_path !== undefined) {
      updates.push('image_path = ?');
      values.push(validator.image_path);
    }

    if (updates.length > 0) {
      values.push(songId);
      await db.connection!.run(
        `UPDATE songs SET ${updates.join(', ')} WHERE song_id = ?`,
        ...values
      );
    }

    await logAudit(AuditAction.SONG_UPDATED, songId, authReq.user?.user_id || null);

    res.json({ message: 'Song updated successfully' });
  } catch (error) {
    next(error);
  }
});

//Remove song from playlist
playlistsRouter.delete('/:id/songs/:songId', requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playlistId = parseInt(req.params.id);
    const songId = parseInt(req.params.songId);
    const authReq = req as AuthRequest;

    if (isNaN(playlistId) || isNaN(songId)) {
      throw new HttpError(400, 'Invalid ID');
    }

    const playlist = await getPlaylistOrFail(playlistId);

    if (playlist.user_id !== authReq.user!.user_id && authReq.user!.role_id !== RoleType.ADMINISTRATOR) {
      throw new HttpError(403, 'You can only remove songs from your own playlists');
    }

    const inPlaylist = await db.connection!.get(
      'SELECT 1 FROM playlist_songs WHERE playlist_id = ? AND song_id = ?',
      playlistId, songId
    );
    if (!inPlaylist) {
      throw new HttpError(404, 'Song not found in playlist');
    }

    await db.connection!.run(
      'DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?',
      playlistId, songId
    );

    await db.connection!.run(
      'UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE playlist_id = ?',
      playlistId
    );

    await logAudit(AuditAction.SONG_REMOVED, songId, authReq.user?.user_id || null);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});


//PLAYLIST LIKES!!!

//Get like count
playlistsRouter.get('/:id/likes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playlistId = parseInt(req.params.id);

    if (isNaN(playlistId)) {
      throw new HttpError(400, 'Invalid playlist ID');
    }

    await getPlaylistOrFail(playlistId);

    const result = await db.connection!.get(
      'SELECT COUNT(*) as count FROM playlist_likes WHERE playlist_id = ?',
      playlistId
    );

    res.json({ playlist_id: playlistId, likes_count: result.count });
  } catch (error) {
    next(error);
  }
});

//Like playlist
playlistsRouter.post('/:id/likes', requireRole([RoleType.REGULAR_USER, RoleType.ADMINISTRATOR, RoleType.MANAGEMENT]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playlistId = parseInt(req.params.id);
    const authReq = req as AuthRequest;

    if (isNaN(playlistId)) {
      throw new HttpError(400, 'Invalid playlist ID');
    }

    await getPlaylistOrFail(playlistId);

    const existing = await db.connection!.get(
      'SELECT 1 FROM playlist_likes WHERE playlist_id = ? AND user_id = ?',
      playlistId, authReq.user!.user_id
    );
    if (existing) {
      throw new HttpError(409, 'You already liked this playlist');
    }

    await db.connection!.run(
      'INSERT INTO playlist_likes (playlist_id, user_id) VALUES (?, ?)',
      playlistId, authReq.user!.user_id
    );

    await logAudit(AuditAction.PLAYLIST_LIKED, playlistId, authReq.user?.user_id || null);

    res.status(201).json({ message: 'Playlist liked' });
  } catch (error) {
    next(error);
  }
});

//Unlike playlist
playlistsRouter.delete('/:id/likes', requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playlistId = parseInt(req.params.id);
    const authReq = req as AuthRequest;

    if (isNaN(playlistId)) {
      throw new HttpError(400, 'Invalid playlist ID');
    }

    await getPlaylistOrFail(playlistId);

    const result = await db.connection!.run(
      'DELETE FROM playlist_likes WHERE playlist_id = ? AND user_id = ?',
      playlistId, authReq.user!.user_id
    );

    if (result.changes === 0) {
      throw new HttpError(404, 'You have not liked this playlist');
    }

    await logAudit(AuditAction.PLAYLIST_UNLIKED, playlistId, authReq.user?.user_id || null);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});


//FAVORITES!!!

//Check if favorites
playlistsRouter.get('/:id/favorites', requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playlistId = parseInt(req.params.id);
    const authReq = req as AuthRequest;

    if (isNaN(playlistId)) {
      throw new HttpError(400, 'Invalid playlist ID');
    }

    await getPlaylistOrFail(playlistId);

    const existing = await db.connection!.get(
      'SELECT added_at FROM playlist_favorites WHERE playlist_id = ? AND user_id = ?',
      playlistId, authReq.user!.user_id
    );

    res.json({
      playlist_id: playlistId,
      is_favorited: !!existing,
      added_at: existing?.added_at || null
    });
  } catch (error) {
    next(error);
  }
});

//Add to favorites
playlistsRouter.post('/:id/favorites', requireRole([RoleType.REGULAR_USER, RoleType.ADMINISTRATOR, RoleType.MANAGEMENT]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playlistId = parseInt(req.params.id);
    const authReq = req as AuthRequest;

    if (isNaN(playlistId)) {
      throw new HttpError(400, 'Invalid playlist ID');
    }

    await getPlaylistOrFail(playlistId);

    const existing = await db.connection!.get(
      'SELECT 1 FROM playlist_favorites WHERE playlist_id = ? AND user_id = ?',
      playlistId, authReq.user!.user_id
    );
    if (existing) {
      throw new HttpError(409, 'Playlist already in favorites');
    }

    await db.connection!.run(
      'INSERT INTO playlist_favorites (playlist_id, user_id) VALUES (?, ?)',
      playlistId, authReq.user!.user_id
    );

    await logAudit(AuditAction.PLAYLIST_FAVORITED, playlistId, authReq.user?.user_id || null);

    res.status(201).json({ message: 'Playlist added to favorites' });
  } catch (error) {
    next(error);
  }
});

//Remove from favorites
playlistsRouter.delete('/:id/favorites', requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playlistId = parseInt(req.params.id);
    const authReq = req as AuthRequest;

    if (isNaN(playlistId)) {
      throw new HttpError(400, 'Invalid playlist ID');
    }

    await getPlaylistOrFail(playlistId);

    const result = await db.connection!.run(
      'DELETE FROM playlist_favorites WHERE playlist_id = ? AND user_id = ?',
      playlistId, authReq.user!.user_id
    );

    if (result.changes === 0) {
      throw new HttpError(404, 'Playlist not in favorites');
    }

    await logAudit(AuditAction.PLAYLIST_UNFAVORITED, playlistId, authReq.user?.user_id || null);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});


//CLICK!!!

// Get click stats (for owner)
playlistsRouter.get('/:id/clicks', requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playlistId = parseInt(req.params.id);
    const authReq = req as AuthRequest;

    if (isNaN(playlistId)) {
      throw new HttpError(400, 'Invalid playlist ID');
    }

    const playlist = await getPlaylistOrFail(playlistId);

    if (playlist.user_id !== authReq.user!.user_id && authReq.user!.role_id !== RoleType.ADMINISTRATOR) {
      throw new HttpError(403, 'You can only view stats for your own playlists');
    }

    const totalClicks = await db.connection!.get(
      'SELECT COUNT(*) as count FROM playlist_clicks WHERE playlist_id = ?',
      playlistId
    );

    const clicksPerDay = await db.connection!.all(`
      SELECT DATE(clicked_at) as date, COUNT(*) as count
      FROM playlist_clicks
      WHERE playlist_id = ? AND clicked_at >= DATE('now', '-30 days')
      GROUP BY DATE(clicked_at)
      ORDER BY date DESC
    `, playlistId);

    res.json({
      playlist_id: playlistId,
      total_clicks: totalClicks.count,
      clicks_per_day: clicksPerDay
    });
  } catch (error) {
    next(error);
  }
});

//Record click
playlistsRouter.post('/:id/clicks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playlistId = parseInt(req.params.id);
    const authReq = req as AuthRequest;

    if (isNaN(playlistId)) {
      throw new HttpError(400, 'Invalid playlist ID');
    }

    await getPlaylistOrFail(playlistId);

    await db.connection!.run(
      'INSERT INTO playlist_clicks (playlist_id, user_id) VALUES (?, ?)',
      playlistId, authReq.user?.user_id || null
    );

    res.status(201).json({ message: 'Click recorded' });
  } catch (error) {
    next(error);
  }
});
