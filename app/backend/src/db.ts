import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

function getDataDir() {
  return process.env.DATA_DIR || path.join(__dirname, '../../data');
}
function getDbPath() {
  return path.join(getDataDir(), 'audiyo.db');
}

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function initDatabase(): void {
  const dataDir = getDataDir();
  const dbPath = getDbPath();
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'QUEUED',
      format TEXT NOT NULL DEFAULT 'mp3',
      title TEXT,
      artist TEXT,
      error TEXT,
      logs TEXT,
      is_playlist INTEGER DEFAULT 0,
      total_tracks INTEGER DEFAULT 1,
      completed_tracks INTEGER DEFAULT 0,
      progress INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);

    CREATE TABLE IF NOT EXISTS download_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      title TEXT,
      artist TEXT,
      downloaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_history_url ON download_history(url);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  console.log('Database initialized at:', dbPath);
}

export interface Job {
  id: string;
  url: string;
  status: 'QUEUED' | 'DOWNLOADING' | 'TAGGING' | 'COMPLETED' | 'FAILED';
  format: string;
  title?: string;
  artist?: string;
  error?: string;
  logs?: string[];
  isPlaylist: boolean;
  totalTracks: number;
  completedTracks: number;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

interface JobRow {
  id: string;
  url: string;
  status: string;
  format: string;
  title: string | null;
  artist: string | null;
  error: string | null;
  logs: string | null;
  is_playlist: number;
  total_tracks: number;
  completed_tracks: number;
  progress: number;
  created_at: string;
  updated_at: string;
}

function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    url: row.url,
    status: row.status as Job['status'],
    format: row.format,
    title: row.title || undefined,
    artist: row.artist || undefined,
    error: row.error || undefined,
    logs: row.logs ? JSON.parse(row.logs) : undefined,
    isPlaylist: row.is_playlist === 1,
    totalTracks: row.total_tracks || 1,
    completedTracks: row.completed_tracks || 0,
    progress: row.progress || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createJob(id: string, url: string, format: string): Job {
  const stmt = db.prepare(`
    INSERT INTO jobs (id, url, format, status)
    VALUES (?, ?, ?, 'QUEUED')
  `);
  stmt.run(id, url, format);
  return getJob(id)!;
}

export function getJob(id: string): Job | null {
  const stmt = db.prepare('SELECT * FROM jobs WHERE id = ?');
  const row = stmt.get(id) as JobRow | undefined;
  return row ? rowToJob(row) : null;
}

export function getAllJobs(): Job[] {
  const stmt = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT 100');
  const rows = stmt.all() as JobRow[];
  return rows.map(rowToJob);
}

export function getQueuedJobs(): Job[] {
  const stmt = db.prepare("SELECT * FROM jobs WHERE status = 'QUEUED' ORDER BY created_at ASC");
  const rows = stmt.all() as JobRow[];
  return rows.map(rowToJob);
}

export function updateJobStatus(id: string, status: Job['status'], error?: string): void {
  const stmt = db.prepare(`
    UPDATE jobs
    SET status = ?, error = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(status, error || null, id);
}

export function updateJobMetadata(id: string, title?: string, artist?: string): void {
  const stmt = db.prepare(`
    UPDATE jobs
    SET title = ?, artist = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(title || null, artist || null, id);
}

export function appendJobLog(id: string, log: string): void {
  const job = getJob(id);
  if (!job) return;
  
  const logs = job.logs || [];
  logs.push(`[${new Date().toISOString()}] ${log}`);
  
  const stmt = db.prepare(`
    UPDATE jobs
    SET logs = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(JSON.stringify(logs), id);
}

export function deleteJob(id: string): boolean {
  const stmt = db.prepare('DELETE FROM jobs WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function resetJob(id: string): boolean {
  const stmt = db.prepare(`
    UPDATE jobs
    SET status = 'QUEUED', error = NULL, logs = NULL, progress = 0, completed_tracks = 0, updated_at = datetime('now')
    WHERE id = ?
  `);
  const result = stmt.run(id);
  return result.changes > 0;
}

export function updateJobProgress(id: string, progress: number, completedTracks?: number, totalTracks?: number): void {
  let sql = `UPDATE jobs SET progress = ?, updated_at = datetime('now')`;
  const params: any[] = [progress];
  
  if (completedTracks !== undefined) {
    sql += `, completed_tracks = ?`;
    params.push(completedTracks);
  }
  if (totalTracks !== undefined) {
    sql += `, total_tracks = ?, is_playlist = ?`;
    params.push(totalTracks, totalTracks > 1 ? 1 : 0);
  }
  
  sql += ` WHERE id = ?`;
  params.push(id);
  
  const stmt = db.prepare(sql);
  stmt.run(...params);
}

export function addToHistory(url: string, title?: string, artist?: string): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO download_history (url, title, artist, downloaded_at)
    VALUES (?, ?, ?, datetime('now'))
  `);
  stmt.run(url, title || null, artist || null);
}

export function isInHistory(url: string): boolean {
  const stmt = db.prepare('SELECT 1 FROM download_history WHERE url = ?');
  return !!stmt.get(url);
}

export function getHistory(): { url: string; title: string | null; artist: string | null; downloadedAt: string }[] {
  const stmt = db.prepare('SELECT url, title, artist, downloaded_at FROM download_history ORDER BY downloaded_at DESC LIMIT 100');
  const rows = stmt.all() as any[];
  return rows.map(r => ({ url: r.url, title: r.title, artist: r.artist, downloadedAt: r.downloaded_at }));
}

export function getSetting(key: string, defaultValue: string = ''): string {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const row = stmt.get(key) as { value: string } | undefined;
  return row ? row.value : defaultValue;
}

export function setSetting(key: string, value: string): void {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  stmt.run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const stmt = db.prepare('SELECT key, value FROM settings');
  const rows = stmt.all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export function cleanupOldJobs(daysOld: number = 7): number {
  const stmt = db.prepare(`
    DELETE FROM jobs 
    WHERE status = 'FAILED' 
    AND created_at < datetime('now', '-' || ? || ' days')
  `);
  const result = stmt.run(daysOld);
  return result.changes;
}
