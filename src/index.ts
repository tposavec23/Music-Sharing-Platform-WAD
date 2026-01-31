import express from 'express';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';

import { errorHandler } from './helpers/errors';
import { openSysDb } from './helpers/sysdb';
import { openDb } from './helpers/db';
import { authRouter, initAuth } from './helpers/auth';
import { usersRouter } from './api/users';
import { genresRouter } from './api/genres';
import { playlistsRouter } from './api/playlists';
import { recommendationsRouter } from './api/recommendations';
import { analyticsRouter } from './api/analytics';
import { auditLogRouter } from './api/auditLog';
import { uploadRouter } from './helpers/fileupload';
import { songsRouter } from './api/songs';

config();

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, 
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

app.use(morgan(process.env.MORGANTYPE || 'tiny'));

const frontendPath = process.env.FRONTEND || './frontend/dist/wad-frontend/browser';
app.use(express.static(frontendPath));

app.use('/uploads', express.static(process.env.UPLOADSDIR || './uploads'));

const apiUrl = process.env.APIURL || '/api';

app.use(express.json());

async function main() {
  await openSysDb();
  console.log('System database connected');

  await initAuth(app);
  console.log('Authentication framework initialized');

  await openDb();
  console.log('Main database connected');

  app.use(apiUrl + '/auth', authLimiter, authRouter);

  // API routes
  app.use(apiUrl + '/users', usersRouter);
  app.use(apiUrl + '/genres', genresRouter);
  app.use(apiUrl + '/playlists', playlistsRouter);
  app.use(apiUrl + '/recommendations', recommendationsRouter);
  app.use(apiUrl + '/analytics', analyticsRouter);
  app.use(apiUrl + '/audit-log', auditLogRouter);
  app.use(apiUrl + '/upload', uploadRouter);
  app.use(apiUrl + '/songs', songsRouter);

  app.use(errorHandler);

  // SPA fallback - serve index.html
app.get('/{*splat}', (req, res) => {
 res.sendFile('index.html', { root: frontendPath });
  });

  // Start server
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server is running on ${port}`);
    console.log(`API available at ${port}${apiUrl}`);
  });
}

console.log('WAD-Project Backend starting...');
main().catch(err => {
  console.error('ERROR: Startup failed:', err);
  process.exit(1);
});
