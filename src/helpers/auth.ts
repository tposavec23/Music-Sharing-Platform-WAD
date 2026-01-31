import { scryptSync, randomBytes } from 'crypto';
import { Express, Request, Response, NextFunction, Router, RequestHandler } from 'express';
import session from 'express-session';
import passport from 'passport';
import SQLiteStoreFactory from 'connect-sqlite3';

import { User, UserValidator, RoleType } from '../model/user';
import { AuditAction } from '../model/audit';
import { HttpError } from './errors';
import { sysdb, reloadUsers, findUserById as dbFindUserById } from './sysdb';
import { logAudit } from './db';

export const authRouter = Router();

interface AuthRequest extends Request {
  user?: User;
}

export const users: User[] = [];

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const hashToCompare = scryptSync(password, salt, 64).toString('hex');
  return hash === hashToCompare;
}

export function requireRole(roles: number[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const user = authReq.user as User | undefined;

    if (!user) {
      throw new HttpError(401, 'Authentication required');
    }

    if (!roles.includes(user.role_id)) {
      throw new HttpError(403, 'You do not have permission to do this');
    }

    next();
  };
}

export function requireAuth(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      throw new HttpError(401, 'Authentication required');
    }
    next();
  };
}

function findUserById(id: number): User | undefined {
  return users.find(u => u.user_id === id);
}

function findUserByUsername(username: string): User | undefined {
  return users.find(u => u.username === username);
}

export async function initAuth(app: Express, reset: boolean = false): Promise<void> {
  const { Strategy } = require('passport-json') as any;

  passport.use(
    new Strategy((username: string, password: string, done: (err: any, user?: User | false, info?: any) => void) => {
      const user = findUserByUsername(username);

      if (!user) {
        return done(null, false, { message: 'User not found' });
      }

      if (!verifyPassword(password, user.password || '')) {
        return done(null, false, { message: 'Invalid password' });
      }

      return done(null, user);
    })
  );

  const SQLiteStore = SQLiteStoreFactory(session);

  app.use(
    session({
      secret: process.env.SECRETKEY || 'your-secret-key',
      resave: false,
      saveUninitialized: false,
      store: new SQLiteStore({
        db: process.env.SESSIONSDBFILE || './db/sessions.sqlite3'
      }) as session.Store,
      cookie: { maxAge: 86400000 } // 1 day
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  if (reset) {
    users.length = 0;
  }

  if (users.length === 0) {
    reloadUsers();
  }
}

passport.serializeUser((user: Express.User, done: (err: any, id?: number) => void) => {
  done(null, (user as User).user_id);
});

passport.deserializeUser((id: number, done: (err: any, user?: User | false | null) => void) => {
  const user = findUserById(id);
  done(null, user || false);
});

//Login
authRouter.post('', passport.authenticate('json'), (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  res.json({
    message: 'Logged in successfully',
    user_id: authReq.user?.user_id,
    username: authReq.user?.username,
    email: authReq.user?.email,
    role_id: authReq.user?.role_id
  });
});

//Logout
authRouter.delete('', (req: Request, res: Response, next: NextFunction) => {
  req.logout((err) => {
    if (err) return next(err);
    res.json({ message: 'Logged out successfully' });
  });
});

//Who is the user
authRouter.get('', (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    const user = req.user as User;
    res.json({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role_id: user.role_id
    });
  } else {
    res.json({
      user_id: null,
      username: null,
      email: null,
      role_id: null
    });
  }
});

//Rregistration
authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, email, password } = req.body;

    const validator = new UserValidator(username, email, password, RoleType.REGULAR_USER);

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
      RoleType.REGULAR_USER
    );

    await logAudit(AuditAction.USER_CREATED, result.lastID!, null);

    reloadUsers();

    res.status(201).json({
      message: 'Registration successful',
      user_id: result.lastID,
      username: validator.username,
      email: validator.email
    });
  } catch (error) {
    next(error);
  }
});
