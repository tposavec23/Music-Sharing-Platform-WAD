import { Router, Request, Response, NextFunction } from 'express';
import { sysdb, reloadUsers } from '../helpers/sysdb';
import { db, logAudit } from '../helpers/db';
import { HttpError } from '../helpers/errors';
import { requireRole, requireAuth, hashPassword, users, verifyPassword } from '../helpers/auth';
import { User, UserValidator, RoleType } from '../model/user';
import { AuditAction } from '../model/audit';

export const usersRouter = Router();

interface AuthRequest extends Request {
  user?: User;
}

//List all users 
usersRouter.get('/', requireRole([RoleType.ADMINISTRATOR]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await sysdb.connection!.all(`
      SELECT u.user_id, u.username, u.email, u.created_at, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      ORDER BY u.user_id
    `);

    res.json(users.map((u: any) => ({
      user_id: u.user_id,
      username: u.username,
      email: u.email,
      created_at: u.created_at,
      role_id: u.role_id,
      role_name: u.role_name
    })));
  } catch (error) {
    next(error);
  }
});

//Create user 
usersRouter.post('/', requireRole([RoleType.ADMINISTRATOR]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, email, password, role_id } = req.body;

    const validator = new UserValidator(username, email, password, role_id ?? RoleType.REGULAR_USER);

    const existingUsername = await sysdb.connection!.get(
      'SELECT user_id FROM users WHERE username = ?', validator.username
    );
    if (existingUsername) {
      throw new HttpError(409, 'Username already exists');
    }

    const existingEmail = await sysdb.connection!.get(
      'SELECT user_id FROM users WHERE email = ?', validator.email
    );
    if (existingEmail) {
      throw new HttpError(409, 'Email already exists');
    }

    const result = await sysdb.connection!.run(
      'INSERT INTO users (username, email, password, role_id) VALUES (?, ?, ?, ?)',
      validator.username,
      validator.email,
      hashPassword(validator.password),
      validator.role_id
    );

    const authReq = req as AuthRequest;

    await logAudit(AuditAction.USER_CREATED, result.lastID!, authReq.user?.user_id || null);

    reloadUsers();

    res.status(201).json({
      message: 'User created successfully',
      user_id: result.lastID,
      username: validator.username,
      email: validator.email,
      role_id: validator.role_id
    });
  } catch (error) {
    next(error);
  }
});

//Get single user
usersRouter.get('/:id', requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.id);
    const authReq = req as AuthRequest;

    if (isNaN(userId)) {
      throw new HttpError(400, 'Invalid user ID');
    }

    if (authReq.user?.role_id !== RoleType.ADMINISTRATOR && authReq.user?.user_id !== userId) {
      throw new HttpError(403, 'You can only view your own profile');
    }

    const user = await sysdb.connection!.get(`
      SELECT u.user_id, u.username, u.email, u.created_at, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      WHERE u.user_id = ?
    `, userId);

    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    res.json({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      created_at: user.created_at,
      role_id: user.role_id,
      role_name: user.role_name
    });
  } catch (error) {
    next(error);
  }
});

//Update user
usersRouter.put('/:id', requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.id);
    const authReq = req as AuthRequest;

    if (isNaN(userId)) {
      throw new HttpError(400, 'Invalid user ID');
    }

    // Only admin can update other users, regular users can only update themselves
    if (authReq.user?.role_id !== RoleType.ADMINISTRATOR && authReq.user?.user_id !== userId) {
      throw new HttpError(403, 'You can only update your own profile');
    }

    const existingUser = await sysdb.connection!.get('SELECT * FROM users WHERE user_id = ?', userId);
    if (!existingUser) {
      throw new HttpError(404, 'User not found');
    }

    const { username, email, password, current_password } = req.body;
    const updates: string[] = [];
    const values: any[] = [];

    // If updating username
    if (username !== undefined) {
      if (!username || username.trim().length === 0) {
        throw new HttpError(400, 'Username cannot be empty');
      }
      if (username.length > 16) {
        throw new HttpError(400, 'Username must be at most 16 characters');
      }
      const taken = await sysdb.connection!.get(
        'SELECT user_id FROM users WHERE username = ? AND user_id != ?',
        username.trim(), userId
      );
      if (taken) {
        throw new HttpError(409, 'Username already taken');
      }
      updates.push('username = ?');
      values.push(username.trim());
    }

    // If updating email
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new HttpError(400, 'Invalid email format');
      }
      const taken = await sysdb.connection!.get(
        'SELECT user_id FROM users WHERE email = ? AND user_id != ?',
        email.toLowerCase().trim(), userId
      );
      if (taken) {
        throw new HttpError(409, 'Email already taken');
      }
      updates.push('email = ?');
      values.push(email.toLowerCase().trim());
    }

    // If updating password
    if (password !== undefined) {
      if (authReq.user?.role_id !== RoleType.ADMINISTRATOR) {
        if (!current_password) {
          throw new HttpError(400, 'Current password is required');
        }
        if (!verifyPassword(current_password, existingUser.password)) {
          throw new HttpError(401, 'Current password is incorrect');
        }
      }
      if (password.length < 6) {
        throw new HttpError(400, 'Password must be at least 6 characters');
      }
      updates.push('password = ?');
      values.push(hashPassword(password));
    }

    if (updates.length === 0) {
      throw new HttpError(400, 'No fields to update');
    }

    values.push(userId);
    await sysdb.connection!.run(
      `UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`,
      ...values
    );

    await logAudit(AuditAction.USER_UPDATED, userId, authReq.user?.user_id || null);

    reloadUsers();

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Delete user
usersRouter.delete('/:id', requireRole([RoleType.ADMINISTRATOR]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.id);
    const authReq = req as AuthRequest;

    if (isNaN(userId)) {
      throw new HttpError(400, 'Invalid user ID');
    }

    if (authReq.user?.user_id === userId) {
      throw new HttpError(400, 'Cannot delete your own account');
    }

    const existingUser = await sysdb.connection!.get('SELECT * FROM users WHERE user_id = ?', userId);
    if (!existingUser) {
      throw new HttpError(404, 'User not found');
    }

    await sysdb.connection!.run('DELETE FROM users WHERE user_id = ?', userId);

    await logAudit(AuditAction.USER_DELETED, userId, authReq.user?.user_id || null);

    reloadUsers();

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

//Change user role
usersRouter.put('/:id/role', requireRole([RoleType.ADMINISTRATOR]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.id);
    const authReq = req as AuthRequest;
    const { role_id } = req.body;

    if (isNaN(userId)) {
      throw new HttpError(400, 'Invalid user ID');
    }

    if (authReq.user?.user_id === userId) {
      throw new HttpError(400, 'Cannot change your own role');
    }

    if (![0, 1, 2, 3].includes(role_id)) {
      throw new HttpError(400, 'Invalid role ID. Must be 0 (Admin), 1 (Management), 2 (Regular User), or 3 (Unregistered)');
    }

    const existingUser = await sysdb.connection!.get('SELECT * FROM users WHERE user_id = ?', userId);
    if (!existingUser) {
      throw new HttpError(404, 'User not found');
    }

    await sysdb.connection!.run('UPDATE users SET role_id = ? WHERE user_id = ?', role_id, userId);

    await logAudit(AuditAction.USER_ROLE_CHANGED, userId, authReq.user?.user_id || null);

    reloadUsers();

    const role = await sysdb.connection!.get('SELECT name FROM roles WHERE role_id = ?', role_id);

    res.json({
      message: 'User role updated successfully',
      user_id: userId,
      role_id: role_id,
      role_name: role?.name
    });
  } catch (error) {
    next(error);
  }
});

//Get users favorite playlists
usersRouter.get('/:id/favorites', requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.id);
    const authReq = req as AuthRequest;

    if (isNaN(userId)) {
      throw new HttpError(400, 'Invalid user ID');
    }

    if (authReq.user?.user_id !== userId && authReq.user?.role_id !== RoleType.ADMINISTRATOR) {
      throw new HttpError(403, 'You can only view your own favorites');
    }

    const favorites = await db.connection!.all(`
      SELECT p.*,
        (SELECT COUNT(*) FROM playlist_likes WHERE playlist_id = p.playlist_id) as likes_count,
        (SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = p.playlist_id) as songs_count
      FROM playlist_favorites pf
      JOIN playlists p ON pf.playlist_id = p.playlist_id
      WHERE pf.user_id = ?
      ORDER BY pf.added_at DESC
    `, userId);

    const favoritesWithDetails = await Promise.all(favorites.map(async (f: any) => {
      const user = await sysdb.connection!.get('SELECT username FROM users WHERE user_id = ?', f.user_id);
      const genres = await db.connection!.all(`
        SELECT g.name FROM genres g
        JOIN playlist_genres pg ON g.genre_id = pg.genre_id
        WHERE pg.playlist_id = ?
      `, f.playlist_id);
      return {
        ...f,
        owner_username: user?.username || null,
        genres: genres.map((g: any) => g.name).join(', ') || null
      };
    }));

    res.json(favoritesWithDetails);
  } catch (error) {
    next(error);
  }
});

//Personalized recommendations
usersRouter.get('/:id/recommendations', requireAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.id);
    const authReq = req as AuthRequest;

    if (isNaN(userId)) {
      throw new HttpError(400, 'Invalid user ID');
    }

    if (authReq.user?.user_id !== userId && authReq.user?.role_id !== RoleType.ADMINISTRATOR) {
      throw new HttpError(403, 'You can only view your own recommendations');
    }

    const likedGenres = await db.connection!.all(`
      SELECT DISTINCT pg.genre_id, g.name, COUNT(*) as count
      FROM playlist_likes pl
      JOIN playlist_genres pg ON pl.playlist_id = pg.playlist_id
      JOIN genres g ON pg.genre_id = g.genre_id
      WHERE pl.user_id = ?
      GROUP BY pg.genre_id
      ORDER BY count DESC
    `, userId);

    let recommendations;
    if (likedGenres.length > 0) {
      const genreIds = likedGenres.map((g: any) => g.genre_id).join(',');
      recommendations = await db.connection!.all(`
        SELECT DISTINCT p.*,
          (SELECT COUNT(*) FROM playlist_likes WHERE playlist_id = p.playlist_id) as likes_count,
          (SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = p.playlist_id) as songs_count
        FROM playlists p
        JOIN playlist_genres pg ON p.playlist_id = pg.playlist_id
        WHERE pg.genre_id IN (${genreIds})
          AND p.is_public = 1
          AND p.user_id != ?
          AND p.playlist_id NOT IN (SELECT playlist_id FROM playlist_likes WHERE user_id = ?)
        ORDER BY likes_count DESC
        LIMIT 10
      `, userId, userId);
    } else {
      recommendations = await db.connection!.all(`
        SELECT p.*,
          (SELECT COUNT(*) FROM playlist_likes WHERE playlist_id = p.playlist_id) as likes_count,
          (SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = p.playlist_id) as songs_count
        FROM playlists p
        WHERE p.is_public = 1 AND p.user_id != ?
        ORDER BY likes_count DESC
        LIMIT 10
      `, userId);
    }

    res.json({
      based_on_genres: likedGenres,
      recommendations: recommendations
    });
  } catch (error) {
    next(error);
  }
});
