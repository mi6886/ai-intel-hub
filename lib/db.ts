import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'monitor.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contents (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      keyword_id TEXT,
      keyword_text TEXT,
      title TEXT NOT NULL,
      platform TEXT NOT NULL,
      author TEXT NOT NULL,
      published_at TEXT NOT NULL,
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      collected INTEGER DEFAULT 0,
      url TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      cover_image TEXT DEFAULT '',
      note_type TEXT DEFAULT '',
      raw_data TEXT,
      fetched_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_contents_category ON contents(category_id);
    CREATE INDEX IF NOT EXISTS idx_contents_platform ON contents(platform);
    CREATE INDEX IF NOT EXISTS idx_contents_published ON contents(published_at);
    CREATE INDEX IF NOT EXISTS idx_contents_keyword ON contents(keyword_text);

    CREATE TABLE IF NOT EXISTS fetch_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      keyword TEXT NOT NULL,
      result_count INTEGER DEFAULT 0,
      fetched_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_fetch_history_category ON fetch_history(category_id);
    CREATE INDEX IF NOT EXISTS idx_fetch_history_keyword ON fetch_history(keyword);

    CREATE TABLE IF NOT EXISTS monitor_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'xiaohongshu',
      date_from TEXT,
      date_to TEXT,
      likes_threshold INTEGER DEFAULT 0,
      comments_threshold INTEGER DEFAULT 0,
      interval_minutes INTEGER DEFAULT 60,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER NOT NULL,
      content_id TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      platform TEXT NOT NULL,
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      url TEXT DEFAULT '',
      published_at TEXT,
      triggered_at TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      UNIQUE(rule_id, content_id)
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(is_read);
    CREATE INDEX IF NOT EXISTS idx_alerts_rule ON alerts(rule_id);
  `);
}

// ===== Content CRUD =====

export interface DbContentItem {
  id: string;
  category_id: string;
  keyword_id: string | null;
  keyword_text: string | null;
  title: string;
  platform: string;
  author: string;
  published_at: string;
  likes: number;
  comments: number;
  shares: number;
  collected: number;
  url: string;
  summary: string;
  cover_image: string;
  note_type: string;
  raw_data: string | null;
  fetched_at: string;
}

export function saveContents(items: DbContentItem[]) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO contents
    (id, category_id, keyword_id, keyword_text, title, platform, author,
     published_at, likes, comments, shares, collected, url, summary,
     cover_image, note_type, raw_data, fetched_at)
    VALUES
    (@id, @category_id, @keyword_id, @keyword_text, @title, @platform, @author,
     @published_at, @likes, @comments, @shares, @collected, @url, @summary,
     @cover_image, @note_type, @raw_data, @fetched_at)
  `);

  const insertMany = db.transaction((items: DbContentItem[]) => {
    for (const item of items) {
      stmt.run(item);
    }
  });

  insertMany(items);
  return items.length;
}

export function getContents(params: {
  categoryId?: string;
  platform?: string;
  date?: string;
  keyword?: string;
  limit?: number;
}): DbContentItem[] {
  const db = getDb();
  const conditions: string[] = [];
  const values: Record<string, string | number> = {};

  if (params.categoryId) {
    conditions.push('category_id = @categoryId');
    values.categoryId = params.categoryId;
  }
  if (params.platform && params.platform !== 'all') {
    conditions.push('platform = @platform');
    values.platform = params.platform;
  }
  if (params.date) {
    conditions.push("date(published_at) = @date");
    values.date = params.date;
  }
  if (params.keyword) {
    conditions.push('keyword_text = @keyword');
    values.keyword = params.keyword;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit || 100;

  const stmt = db.prepare(`
    SELECT * FROM contents ${where}
    ORDER BY likes DESC, published_at DESC
    LIMIT ${limit}
  `);

  return stmt.all(values) as DbContentItem[];
}

export function getContentDates(categoryId: string, platform?: string): { date: string; count: number }[] {
  const db = getDb();
  let query = `
    SELECT date(published_at) as date, COUNT(*) as count
    FROM contents
    WHERE category_id = @categoryId
  `;
  const values: Record<string, string> = { categoryId };

  if (platform && platform !== 'all') {
    query += ' AND platform = @platform';
    values.platform = platform;
  }

  query += ' GROUP BY date(published_at) ORDER BY date DESC';

  return db.prepare(query).all(values) as { date: string; count: number }[];
}

// ===== Fetch History =====

export interface DbFetchHistory {
  id: number;
  category_id: string;
  platform: string;
  keyword: string;
  result_count: number;
  fetched_at: string;
}

export function saveFetchHistory(record: Omit<DbFetchHistory, 'id'>): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO fetch_history (category_id, platform, keyword, result_count, fetched_at)
    VALUES (@category_id, @platform, @keyword, @result_count, @fetched_at)
  `).run(record);
  return result.lastInsertRowid as number;
}

export function getFetchHistory(params: {
  categoryId?: string;
  platform?: string;
  keyword?: string;
}): (DbFetchHistory & { top_contents: DbContentItem[] })[] {
  const db = getDb();
  const conditions: string[] = [];
  const values: Record<string, string> = {};

  if (params.categoryId) {
    conditions.push('category_id = @categoryId');
    values.categoryId = params.categoryId;
  }
  if (params.platform && params.platform !== 'all') {
    conditions.push('platform = @platform');
    values.platform = params.platform;
  }
  if (params.keyword) {
    conditions.push('keyword LIKE @keyword');
    values.keyword = `%${params.keyword}%`;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const histories = db.prepare(`
    SELECT * FROM fetch_history ${where} ORDER BY fetched_at DESC LIMIT 50
  `).all(values) as DbFetchHistory[];

  // Attach top 3 contents for each history record
  const contentsStmt = db.prepare(`
    SELECT * FROM contents
    WHERE category_id = @categoryId AND keyword_text = @keyword AND platform = @platform
    ORDER BY likes DESC LIMIT 3
  `);

  return histories.map((h) => ({
    ...h,
    top_contents: contentsStmt.all({
      categoryId: h.category_id,
      keyword: h.keyword,
      platform: h.platform,
    }) as DbContentItem[],
  }));
}

export function getContentsByFetchKeyword(categoryId: string, platform: string, keyword: string): DbContentItem[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM contents
    WHERE category_id = @categoryId AND platform = @platform AND keyword_text = @keyword
    ORDER BY likes DESC
  `).all({ categoryId, platform, keyword }) as DbContentItem[];
}

export function deleteContentsByKeyword(categoryId: string, keywordText: string) {
  const db = getDb();
  db.prepare('DELETE FROM contents WHERE category_id = @categoryId AND keyword_text = @keywordText')
    .run({ categoryId, keywordText });
}

// ===== Monitor Rules =====

export interface DbMonitorRule {
  id: number;
  category_id: string;
  keyword: string;
  platform: string;
  date_from: string | null;
  date_to: string | null;
  likes_threshold: number;
  comments_threshold: number;
  interval_minutes: number;
  enabled: number;
  last_run_at: string | null;
  created_at: string;
}

export function getMonitorRules(categoryId?: string): DbMonitorRule[] {
  const db = getDb();
  if (categoryId) {
    return db.prepare('SELECT * FROM monitor_rules WHERE category_id = @categoryId ORDER BY created_at DESC')
      .all({ categoryId }) as DbMonitorRule[];
  }
  return db.prepare('SELECT * FROM monitor_rules ORDER BY created_at DESC').all() as DbMonitorRule[];
}

export function getActiveMonitorRules(): DbMonitorRule[] {
  const db = getDb();
  return db.prepare('SELECT * FROM monitor_rules WHERE enabled = 1').all() as DbMonitorRule[];
}

export function createMonitorRule(rule: Omit<DbMonitorRule, 'id' | 'last_run_at'>): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO monitor_rules (category_id, keyword, platform, date_from, date_to,
      likes_threshold, comments_threshold, interval_minutes, enabled, created_at)
    VALUES (@category_id, @keyword, @platform, @date_from, @date_to,
      @likes_threshold, @comments_threshold, @interval_minutes, @enabled, @created_at)
  `).run(rule);
  return result.lastInsertRowid as number;
}

export function updateMonitorRuleLastRun(ruleId: number) {
  const db = getDb();
  db.prepare('UPDATE monitor_rules SET last_run_at = @now WHERE id = @id')
    .run({ id: ruleId, now: new Date().toISOString() });
}

export function toggleMonitorRule(ruleId: number, enabled: boolean) {
  const db = getDb();
  db.prepare('UPDATE monitor_rules SET enabled = @enabled WHERE id = @id')
    .run({ id: ruleId, enabled: enabled ? 1 : 0 });
}

export function deleteMonitorRule(ruleId: number) {
  const db = getDb();
  db.prepare('DELETE FROM alerts WHERE rule_id = @id').run({ id: ruleId });
  db.prepare('DELETE FROM monitor_rules WHERE id = @id').run({ id: ruleId });
}

// ===== Alerts =====

export interface DbAlert {
  id: number;
  rule_id: number;
  content_id: string;
  title: string;
  author: string;
  platform: string;
  likes: number;
  comments: number;
  collected: number;
  url: string;
  published_at: string | null;
  triggered_at: string;
  is_read: number;
}

export function createAlert(alert: Omit<DbAlert, 'id'>): number | null {
  const db = getDb();
  try {
    const result = db.prepare(`
      INSERT OR IGNORE INTO alerts (rule_id, content_id, title, author, platform,
        likes, comments, collected, url, published_at, triggered_at, is_read)
      VALUES (@rule_id, @content_id, @title, @author, @platform,
        @likes, @comments, @collected, @url, @published_at, @triggered_at, @is_read)
    `).run(alert);
    return result.changes > 0 ? (result.lastInsertRowid as number) : null;
  } catch {
    return null;
  }
}

export function getAlerts(params: { unreadOnly?: boolean; limit?: number }): (DbAlert & { keyword?: string })[] {
  const db = getDb();
  const where = params.unreadOnly ? 'WHERE a.is_read = 0' : '';
  const limit = params.limit || 50;
  return db.prepare(`
    SELECT a.*, r.keyword FROM alerts a
    LEFT JOIN monitor_rules r ON a.rule_id = r.id
    ${where}
    ORDER BY a.triggered_at DESC LIMIT ${limit}
  `).all() as (DbAlert & { keyword?: string })[];
}

export function getUnreadAlertCount(): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE is_read = 0').get() as { count: number };
  return row.count;
}

export function markAlertsRead(alertIds?: number[]) {
  const db = getDb();
  if (alertIds && alertIds.length > 0) {
    const placeholders = alertIds.map(() => '?').join(',');
    db.prepare(`UPDATE alerts SET is_read = 1 WHERE id IN (${placeholders})`).run(...alertIds);
  } else {
    db.prepare('UPDATE alerts SET is_read = 1 WHERE is_read = 0').run();
  }
}
