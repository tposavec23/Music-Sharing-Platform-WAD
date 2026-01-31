import { HttpError } from "../helpers/errors";

export interface Role {
  role_id: number;
  name: string;
}

export interface User {
  user_id: number;
  username: string;
  email: string;
  password: string;
  created_at: Date;
  role_id: number;
}

export enum RoleType {
  ADMINISTRATOR = 0,
  MANAGEMENT = 1,
  REGULAR_USER = 2,
  UNREGISTERED = 3
}

export const DEFAULT_ROLES: Role[] = [
  { role_id: 0, name: 'Administrator' },
  { role_id: 1, name: 'Management' },
  { role_id: 2, name: 'Regular User' },
  { role_id: 3, name: 'Unregistered' }
];

export class UserValidator {
  username: string;
  email: string;
  password: string;
  role_id: number;

  constructor(username: string, email: string, password: string, role_id: number = RoleType.REGULAR_USER) {
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      throw new HttpError(400, 'Username is required');
    }
    if (username.length > 16) {
      throw new HttpError(400, 'Username must be at most 16 characters');
    }

  
    if (!email || typeof email !== 'string') {
      throw new HttpError(400, 'Email is required');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new HttpError(400, 'Invalid email format');
    }


    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new HttpError(400, 'Password must be at least 6 characters');
    }

    if (![0, 1, 2, 3].includes(role_id)) {
      throw new HttpError(400, 'Invalid role');
    }

    this.username = username.trim();
    this.email = email.toLowerCase().trim();
    this.password = password;
    this.role_id = role_id;
  }
}
