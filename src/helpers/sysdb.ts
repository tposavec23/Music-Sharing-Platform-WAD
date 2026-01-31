// System database helper
// Handles roles and users tables

import { open, Database } from "sqlite";
import sqlite3 from "sqlite3";

import { hashPassword, users } from "./auth";
import { User, DEFAULT_ROLES, RoleType } from "../model/user";

export const sysdb: { connection: Database | null } = {
  connection: null
};

export async function openSysDb(): Promise<void> {
  sysdb.connection = await open({
    filename: process.env.SYSDBFILE || './db/sysdb.sqlite3',
    driver: sqlite3.Database
  });

  const { user_version } = await sysdb.connection.get('PRAGMA user_version;');

  if (!user_version) {
    console.log('Initializing system database...');
    await sysdb.connection.exec('PRAGMA user_version = 1;');
    await createSchemaAndData();
  }

  await sysdb.connection.exec('PRAGMA foreign_keys = ON');
}

async function createSchemaAndData(): Promise<void> {
  const createRolesTable = `
    CREATE TABLE IF NOT EXISTS roles (
      role_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    )`;

  await sysdb.connection!.exec(createRolesTable);
  console.log('Roles table created');

  for (const role of DEFAULT_ROLES) {
    await sysdb.connection!.run(
      'INSERT INTO roles (role_id, name) VALUES (?, ?)',
      role.role_id, role.name
    );
  }
  console.log('Default roles inserted');

  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      role_id INTEGER NOT NULL DEFAULT 2,
      FOREIGN KEY (role_id) REFERENCES roles(role_id)
    )`;

  await sysdb.connection!.exec(createUsersTable);
  console.log('Users table created');

  // Insert default admin user
  await sysdb.connection!.run(
    'INSERT INTO users (username, email, password, role_id) VALUES (?, ?, ?, ?)',
    'admin',
    'admin@example.com',
    hashPassword(process.env.ADMINPASSWORD || 'Admin123'),
    RoleType.ADMINISTRATOR
  );

  // Insert default regular user
  await sysdb.connection!.run(
    'INSERT INTO users (username, email, password, role_id) VALUES (?, ?, ?, ?)',
    'user',
    'user@example.com',
    hashPassword(process.env.USERPASSWORD || 'User123'),
    RoleType.REGULAR_USER
  );

  // Insert default manager
  await sysdb.connection!.run(
    'INSERT INTO users (username, email, password, role_id) VALUES (?, ?, ?, ?)',
    'manager',
    'manager@example.com',
    hashPassword(process.env.USERPASSWORD || 'User123'),
    RoleType.MANAGEMENT
  );

  console.log('Default users created (admin, user, manager)');
}

export async function loadUsers(): Promise<User[]> {
  const rows = await sysdb.connection!.all('SELECT * FROM users');
  return rows.map((row: any) => ({
    user_id: row.user_id,
    username: row.username,
    email: row.email,
    password: row.password,
    created_at: new Date(row.created_at),
    role_id: row.role_id
  } as User));
}

export function reloadUsers(): void {
  users.length = 0;
  loadUsers().then(loadedUsers => {
    users.push(...loadedUsers);
  });
}

export async function findUserById(id: number): Promise<User | undefined> {
  const row = await sysdb.connection!.get('SELECT * FROM users WHERE user_id = ?', id);
  if (!row) return undefined;
  return {
    user_id: row.user_id,
    username: row.username,
    email: row.email,
    password: row.password,
    created_at: new Date(row.created_at),
    role_id: row.role_id
  };
}

export async function findUserByUsername(username: string): Promise<User | undefined> {
  const row = await sysdb.connection!.get('SELECT * FROM users WHERE username = ?', username);
  if (!row) return undefined;
  return {
    user_id: row.user_id,
    username: row.username,
    email: row.email,
    password: row.password,
    created_at: new Date(row.created_at),
    role_id: row.role_id
  };
}
