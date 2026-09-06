import Database from 'better-sqlite3';
import { config } from '../config.js';

export function createDb(path: string = config.dbPath): Database.Database {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS codebases (
      id TEXT PRIMARY KEY,
      manifest_json TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS codebase_files (
      codebase_id TEXT NOT NULL,
      path TEXT NOT NULL,
      content TEXT NOT NULL,
      is_high_signal INTEGER NOT NULL,
      PRIMARY KEY (codebase_id, path)
    );

    CREATE TABLE IF NOT EXISTS context_blocks (
      codebase_id TEXT PRIMARY KEY,
      content_hash TEXT NOT NULL,
      block_text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usage_records (
      id TEXT PRIMARY KEY,
      codebase_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      template TEXT,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cache_creation_input_tokens INTEGER NOT NULL,
      cache_read_input_tokens INTEGER NOT NULL
    );
  `);
  return db;
}

export type Db = Database.Database;
