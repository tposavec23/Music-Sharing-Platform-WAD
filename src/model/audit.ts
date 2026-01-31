export interface AuditLog {
  id: number;
  action: string;
  target_id: number | null;
  timestamp: Date;
  user_id: number | null;
}

export interface AuditLogWithUser extends AuditLog {
  username?: string;
}

export enum AuditAction {

  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',

  GENRE_CREATED = 'GENRE_CREATED',
  GENRE_UPDATED = 'GENRE_UPDATED',
  GENRE_DELETED = 'GENRE_DELETED',

  PLAYLIST_CREATED = 'PLAYLIST_CREATED',
  PLAYLIST_UPDATED = 'PLAYLIST_UPDATED',
  PLAYLIST_DELETED = 'PLAYLIST_DELETED',
  PLAYLIST_PUBLISHED = 'PLAYLIST_PUBLISHED',
  PLAYLIST_UNPUBLISHED = 'PLAYLIST_UNPUBLISHED',

  SONG_ADDED = 'SONG_ADDED',
  SONG_UPDATED = 'SONG_UPDATED',
  SONG_REMOVED = 'SONG_REMOVED',

  PLAYLIST_LIKED = 'PLAYLIST_LIKED',
  PLAYLIST_UNLIKED = 'PLAYLIST_UNLIKED',
  PLAYLIST_FAVORITED = 'PLAYLIST_FAVORITED',
  PLAYLIST_UNFAVORITED = 'PLAYLIST_UNFAVORITED'
}

export function formatAuditMessage(action: AuditAction, details?: Record<string, any>): string {
  const baseMessages: Record<AuditAction, string> = {
    [AuditAction.USER_CREATED]: 'User account created',
    [AuditAction.USER_UPDATED]: 'User account updated',
    [AuditAction.USER_DELETED]: 'User account deleted',
    [AuditAction.USER_ROLE_CHANGED]: 'User role changed',
    [AuditAction.USER_LOGIN]: 'User logged in',
    [AuditAction.USER_LOGOUT]: 'User logged out',
    [AuditAction.GENRE_CREATED]: 'Genre created',
    [AuditAction.GENRE_UPDATED]: 'Genre updated',
    [AuditAction.GENRE_DELETED]: 'Genre deleted',
    [AuditAction.PLAYLIST_CREATED]: 'Playlist created',
    [AuditAction.PLAYLIST_UPDATED]: 'Playlist updated',
    [AuditAction.PLAYLIST_DELETED]: 'Playlist deleted',
    [AuditAction.PLAYLIST_PUBLISHED]: 'Playlist published',
    [AuditAction.PLAYLIST_UNPUBLISHED]: 'Playlist unpublished',
    [AuditAction.SONG_ADDED]: 'Song added to playlist',
    [AuditAction.SONG_UPDATED]: 'Song updated in playlist',
    [AuditAction.SONG_REMOVED]: 'Song removed from playlist',
    [AuditAction.PLAYLIST_LIKED]: 'Playlist liked',
    [AuditAction.PLAYLIST_UNLIKED]: 'Playlist unliked',
    [AuditAction.PLAYLIST_FAVORITED]: 'Playlist added to favorites',
    [AuditAction.PLAYLIST_UNFAVORITED]: 'Playlist removed from favorites'
  };

  let message = baseMessages[action] || action;

  if (details) {
    const detailStr = Object.entries(details)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    message += ` (${detailStr})`;
  }

  return message;
}
