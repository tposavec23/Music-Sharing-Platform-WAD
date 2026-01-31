import { open, Database } from "sqlite";
import sqlite3 from "sqlite3";

export const db: { connection: Database | null } = {
  connection: null
};

interface TableDef {
  name: string;
  columns: {
    [key: string]: {
      type: string;
      primaryKey?: boolean;
      autoincrement?: boolean;
      notNull?: boolean;
      unique?: boolean;
      default?: any;
      skipFiltering?: boolean;
    };
  };
  primaryKey?: string[];
  foreignKeys?: { column: string; references: string }[];
}

function createTableStatement(def: TableDef): string {
  const cols = Object.entries(def.columns).map(([name, opts]) => {
    let colDef = `${name} ${opts.type}`;
    if (opts.primaryKey) colDef += ' PRIMARY KEY';
    if (opts.autoincrement) colDef += ' AUTOINCREMENT';
    if (opts.notNull) colDef += ' NOT NULL';
    if (opts.unique) colDef += ' UNIQUE';
    if (opts.default !== undefined) colDef += ` DEFAULT ${opts.default}`;
    return colDef;
  });

  if (def.primaryKey) {
    cols.push(`PRIMARY KEY (${def.primaryKey.join(', ')})`);
  }

  if (def.foreignKeys) {
    def.foreignKeys.forEach(fk => {
      cols.push(`FOREIGN KEY (${fk.column}) REFERENCES ${fk.references}`);
    });
  }

  return `CREATE TABLE IF NOT EXISTS ${def.name} (\n  ${cols.join(',\n  ')}\n);`;
}


export const genresTableDef: TableDef = {
  name: 'genres',
  columns: {
    genre_id: { type: 'INTEGER', primaryKey: true, autoincrement: true },
    name: { type: 'TEXT', notNull: true, unique: true },
    created_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    user_id: { type: 'INTEGER', notNull: true }
  }
};

export const playlistsTableDef: TableDef = {
  name: 'playlists',
  columns: {
    playlist_id: { type: 'INTEGER', primaryKey: true, autoincrement: true },
    name: { type: 'TEXT', notNull: true },
    is_public: { type: 'INTEGER', notNull: true, default: 1 },
    created_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    user_id: { type: 'INTEGER', notNull: true },
    image_path: { type: 'TEXT', skipFiltering: true },
    description: { type: 'TEXT' }
  }
};

export const songsTableDef: TableDef = {
  name: 'songs',
  columns: {
    song_id: { type: 'INTEGER', primaryKey: true, autoincrement: true },
    title: { type: 'TEXT', notNull: true },
    artist: { type: 'TEXT', notNull: true },
    duration: { type: 'REAL' },
    platform: { type: 'TEXT', notNull: true }, // 'youtube' or 'spotify'
    url: { type: 'TEXT', notNull: true },
    added_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    image_path: { type: 'TEXT', skipFiltering: true }
  }
};

export const playlistSongsTableDef: TableDef = {
  name: 'playlist_songs',
  columns: {
    playlist_id: { type: 'INTEGER', notNull: true },
    song_id: { type: 'INTEGER', notNull: true }
  },
  primaryKey: ['playlist_id', 'song_id'],
  foreignKeys: [
    { column: 'playlist_id', references: 'playlists(playlist_id)' },
    { column: 'song_id', references: 'songs(song_id)' }
  ]
};

export const playlistGenresTableDef: TableDef = {
  name: 'playlist_genres',
  columns: {
    playlist_id: { type: 'INTEGER', notNull: true },
    genre_id: { type: 'INTEGER', notNull: true }
  },
  primaryKey: ['playlist_id', 'genre_id'],
  foreignKeys: [
    { column: 'playlist_id', references: 'playlists(playlist_id)' },
    { column: 'genre_id', references: 'genres(genre_id)' }
  ]
};

export const playlistLikesTableDef: TableDef = {
  name: 'playlist_likes',
  columns: {
    playlist_id: { type: 'INTEGER', notNull: true },
    user_id: { type: 'INTEGER', notNull: true },
    liked_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' }
  },
  primaryKey: ['playlist_id', 'user_id'],
  foreignKeys: [
    { column: 'playlist_id', references: 'playlists(playlist_id)' }
  ]
};

export const playlistFavoritesTableDef: TableDef = {
  name: 'playlist_favorites',
  columns: {
    playlist_id: { type: 'INTEGER', notNull: true },
    user_id: { type: 'INTEGER', notNull: true },
    added_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' }
  },
  primaryKey: ['playlist_id', 'user_id'],
  foreignKeys: [
    { column: 'playlist_id', references: 'playlists(playlist_id)' }
  ]
};

export const playlistClicksTableDef: TableDef = {
  name: 'playlist_clicks',
  columns: {
    click_id: { type: 'INTEGER', primaryKey: true, autoincrement: true },
    clicked_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    user_id: { type: 'INTEGER' },
    playlist_id: { type: 'INTEGER', notNull: true }
  },
  foreignKeys: [
    { column: 'playlist_id', references: 'playlists(playlist_id)' }
  ]
};

export const auditLogTableDef: TableDef = {
  name: 'audit_log',
  columns: {
    id: { type: 'INTEGER', primaryKey: true, autoincrement: true },
    action: { type: 'TEXT', notNull: true },
    target_id: { type: 'INTEGER' },
    timestamp: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    user_id: { type: 'INTEGER' }
  }
};


//Inirialization of Database

export async function openDb(): Promise<void> {
  db.connection = await open({
    filename: process.env.DBFILE || './db/data.sqlite3',
    driver: sqlite3.Database
  });

  const { user_version } = await db.connection.get('PRAGMA user_version;');

  if (!user_version) {
    console.log('Initializing main database...');
    await db.connection.exec('PRAGMA user_version = 1;');
    await createSchemaAndData();
  }

  await db.connection.exec('PRAGMA foreign_keys = ON');
}

async function createSchemaAndData(): Promise<void> {

  await db.connection!.exec(createTableStatement(genresTableDef));
  console.log('Genres table created');

  const defaultGenres = ['Rock', 'EDM', 'Hip-Hop', 'Chill', 'Workout', 'Pop', 'Jazz', 'Classical'];
  for (const genre of defaultGenres) {
    await db.connection!.run(
      'INSERT INTO genres (name, user_id) VALUES (?, ?)',
      genre, 1
    );
  }
  console.log('Default genres inserted');

  await db.connection!.exec(createTableStatement(songsTableDef));
  console.log('Songs table created');

  await db.connection!.exec(createTableStatement(playlistsTableDef));
  console.log('Playlists table created');

  await db.connection!.exec(createTableStatement(playlistSongsTableDef));
  console.log('Playlist_songs table created');

  await db.connection!.exec(createTableStatement(playlistGenresTableDef));
  console.log('Playlist_genres table created');

  await db.connection!.exec(createTableStatement(playlistLikesTableDef));
  console.log('Playlist_likes table created');

  await db.connection!.exec(createTableStatement(playlistFavoritesTableDef));
  console.log('Playlist_favorites table created');

  await db.connection!.exec(createTableStatement(playlistClicksTableDef));
  console.log('Playlist_clicks table created');

  await db.connection!.exec(createTableStatement(auditLogTableDef));
  console.log('Audit_log table created');

  console.log('Main database initialization complete!');
}

export async function logAudit(action: string, target_id: number | null, user_id: number | null): Promise<void> {
  await db.connection!.run(
    'INSERT INTO audit_log (action, target_id, user_id) VALUES (?, ?, ?)',
    action, target_id, user_id
  );
}
