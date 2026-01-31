import { Router, Request, Response, NextFunction } from 'express';
import { sysdb } from '../helpers/sysdb';
import { db, logAudit } from '../helpers/db';
import { HttpError } from '../helpers/errors';
import { requireRole, requireAuth } from '../helpers/auth';
import { User, RoleType } from '../model/user';
import { GenreValidator } from '../model/genre';
import { AuditAction } from '../model/audit';

export const genresRouter = Router();

interface AuthRequest extends Request {
  user?: User;
}

async function getUsername(userId: number): Promise<string | null> {
  const user = await sysdb.connection!.get('SELECT username FROM users WHERE user_id = ?', userId);
  return user?.username || null;
}

genresRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const genresRaw = await db.connection!.all(`
      SELECT g.*
      FROM genres g
      ORDER BY g.name
    `);

    const genres = await Promise.all(genresRaw.map(async (g: any) => ({
      ...g,
      created_by: await getUsername(g.user_id)
    })));

    res.json(genres);
  } catch (error) {
    next(error);
  }
});

genresRouter.post('/', requireRole([RoleType.MANAGEMENT]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const { name } = req.body;

    const validator = new GenreValidator(name, authReq.user!.user_id);

    const existing = await db.connection!.get(
      'SELECT genre_id FROM genres WHERE LOWER(name) = LOWER(?)',
      validator.name
    );
    if (existing) {
      throw new HttpError(409, 'Genre already exists');
    }

    const result = await db.connection!.run(
      'INSERT INTO genres (name, user_id) VALUES (?, ?)',
      validator.name,
      validator.user_id
    );

    await logAudit(AuditAction.GENRE_CREATED, result.lastID!, authReq.user?.user_id || null);

    res.status(201).json({
      message: 'Genre created successfully',
      genre_id: result.lastID,
      name: validator.name
    });
  } catch (error) {
    next(error);
  }
});

genresRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const genreId = parseInt(req.params.id);

    if (isNaN(genreId)) {
      throw new HttpError(400, 'Invalid genre ID');
    }

    const genreRaw = await db.connection!.get(`
      SELECT g.*,
        (SELECT COUNT(DISTINCT pg.playlist_id) FROM playlist_genres pg WHERE pg.genre_id = g.genre_id) as playlist_count
      FROM genres g
      WHERE g.genre_id = ?
    `, genreId);

    if (!genreRaw) {
      throw new HttpError(404, 'Genre not found');
    }

    const genre = {
      ...genreRaw,
      created_by: await getUsername(genreRaw.user_id)
    };

    res.json(genre);
  } catch (error) {
    next(error);
  }
});

genresRouter.put('/:id', requireRole([RoleType.MANAGEMENT]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const genreId = parseInt(req.params.id);
    const authReq = req as AuthRequest;
    const { name } = req.body;

    if (isNaN(genreId)) {
      throw new HttpError(400, 'Invalid genre ID');
    }

    const existing = await db.connection!.get('SELECT * FROM genres WHERE genre_id = ?', genreId);
    if (!existing) {
      throw new HttpError(404, 'Genre not found');
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new HttpError(400, 'Genre name is required');
    }
    if (name.trim().length > 255) {
      throw new HttpError(400, 'Genre name must be at most 255 characters');
    }

    const taken = await db.connection!.get(
      'SELECT genre_id FROM genres WHERE LOWER(name) = LOWER(?) AND genre_id != ?',
      name.trim(), genreId
    );
    if (taken) {
      throw new HttpError(409, 'Genre name already exists');
    }

    await db.connection!.run('UPDATE genres SET name = ? WHERE genre_id = ?', name.trim(), genreId);

    await logAudit(AuditAction.GENRE_UPDATED, genreId, authReq.user?.user_id || null);

    res.json({
      message: 'Genre updated successfully',
      genre_id: genreId,
      name: name.trim()
    });
  } catch (error) {
    next(error);
  }
});

genresRouter.delete('/:id', requireRole([RoleType.MANAGEMENT]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const genreId = parseInt(req.params.id);
    const authReq = req as AuthRequest;

    if (isNaN(genreId)) {
      throw new HttpError(400, 'Invalid genre ID');
    }

    const existing = await db.connection!.get('SELECT * FROM genres WHERE genre_id = ?', genreId);
    if (!existing) {
      throw new HttpError(404, 'Genre not found');
    }

    const playlistCount = await db.connection!.get(
      'SELECT COUNT(*) as count FROM playlist_genres WHERE genre_id = ?',
      genreId
    );
    if (playlistCount.count > 0) {
      throw new HttpError(400, `Cannot delete genre. It is used by ${playlistCount.count} playlist(s). Remove genre from playlists first.`);
    }

    await db.connection!.run('DELETE FROM genres WHERE genre_id = ?', genreId);

    await logAudit(AuditAction.GENRE_DELETED, genreId, authReq.user?.user_id || null);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
