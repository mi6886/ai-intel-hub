import { getDb, saveContents, createAlert, saveFetchHistory, DbContentItem } from './db';

export interface IngestItem {
  platform: string;
  note_id: string;
  title: string;
  desc: string;
  author_name: string;
  author_id: string;
  url: string;
  cover_image: string;
  published_at: string;
  likes: number;
  comments: number;
  collected: number;
  shares: number;
  matched_rule: {
    type: 'keyword' | 'account';
    value: string;
  };
}

export interface IngestResult {
  success: boolean;
  inserted: number;
  updated: number;
  new_alerts: number;
  errors: string[];
}

function itemToDbContent(item: IngestItem, categoryId: string): DbContentItem {
  return {
    id: `${item.platform}-${item.note_id}`,
    category_id: categoryId,
    keyword_id: null,
    keyword_text: item.matched_rule.value,
    title: item.title || '(无标题)',
    platform: item.platform,
    author: item.author_name || '未知用户',
    published_at: item.published_at,
    likes: item.likes || 0,
    comments: item.comments || 0,
    shares: item.shares || 0,
    collected: item.collected || 0,
    url: item.url || '',
    summary: item.desc || '',
    cover_image: item.cover_image || '',
    note_type: 'normal',
    raw_data: JSON.stringify(item),
    fetched_at: new Date().toISOString(),
  };
}

export function processIngestItems(
  items: IngestItem[],
  categoryId: string
): IngestResult {
  const result: IngestResult = {
    success: true,
    inserted: 0,
    updated: 0,
    new_alerts: 0,
    errors: [],
  };

  if (items.length === 0) return result;

  const db = getDb();

  // 1. Save contents
  const dbItems = items.map((i) => itemToDbContent(i, categoryId));
  const ids = dbItems.map((d) => d.id);
  const placeholders = ids.map(() => '?').join(',');
  const existingRows = db
    .prepare(`SELECT id FROM contents WHERE id IN (${placeholders})`)
    .all(...ids) as Array<{ id: string }>;
  const existingSet = new Set(existingRows.map((r) => r.id));

  try {
    saveContents(dbItems);
    result.updated = dbItems.filter((d) => existingSet.has(d.id)).length;
    result.inserted = dbItems.length - result.updated;
  } catch (e) {
    result.errors.push(`saveContents failed: ${e instanceof Error ? e.message : String(e)}`);
    result.success = false;
    return result;
  }

  // 2. Match against monitor_rules and create alerts
  const now = new Date();
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const cutoffDate = twoDaysAgo.toISOString().split('T')[0];

  // Gather unique rule keywords from the batch and fetch all matching rules in one query
  const keywords = [...new Set(items.map((i) => i.matched_rule.value))];
  const kwPlaceholders = keywords.map(() => '?').join(',');
  const allRules = db
    .prepare(
      `SELECT id, keyword, likes_threshold, comments_threshold, date_from, date_to
       FROM monitor_rules
       WHERE category_id = ? AND enabled = 1 AND keyword IN (${kwPlaceholders})`
    )
    .all(categoryId, ...keywords) as Array<{
    id: number;
    keyword: string;
    likes_threshold: number;
    comments_threshold: number;
    date_from: string | null;
    date_to: string | null;
  }>;

  // Group rules by keyword for O(1) lookup
  const rulesByKeyword = new Map<string, typeof allRules>();
  for (const rule of allRules) {
    const list = rulesByKeyword.get(rule.keyword) || [];
    list.push(rule);
    rulesByKeyword.set(rule.keyword, list);
  }

  for (const item of items) {
    const rules = rulesByKeyword.get(item.matched_rule.value) || [];

    for (const rule of rules) {
      const pubDate = item.published_at.split('T')[0];
      if (rule.date_from || rule.date_to) {
        if (rule.date_from && pubDate < rule.date_from) continue;
        if (rule.date_to && pubDate > rule.date_to) continue;
      } else {
        if (pubDate < cutoffDate) continue;
      }
      if (rule.likes_threshold > 0 && item.likes < rule.likes_threshold) continue;
      if (rule.comments_threshold > 0 && item.comments < rule.comments_threshold) continue;

      const alertId = createAlert({
        rule_id: rule.id,
        content_id: `${item.platform}-${item.note_id}`,
        title: item.title,
        author: item.author_name,
        platform: item.platform,
        likes: item.likes,
        comments: item.comments,
        collected: item.collected,
        url: item.url,
        published_at: item.published_at,
        triggered_at: new Date().toISOString(),
        is_read: 0,
      });
      if (alertId !== null) result.new_alerts++;
    }
  }

  // 3. Record fetch history — one row per distinct (platform, keyword) pair
  const historyGroups = new Map<string, { platform: string; keyword: string; count: number }>();
  for (const item of items) {
    const key = `${item.platform}::${item.matched_rule.value}`;
    const existing = historyGroups.get(key);
    if (existing) {
      existing.count++;
    } else {
      historyGroups.set(key, {
        platform: item.platform,
        keyword: item.matched_rule.value,
        count: 1,
      });
    }
  }

  try {
    const fetchedAt = new Date().toISOString();
    for (const group of historyGroups.values()) {
      saveFetchHistory({
        category_id: categoryId,
        platform: group.platform,
        keyword: group.keyword,
        result_count: group.count,
        fetched_at: fetchedAt,
      });
    }
  } catch (e) {
    result.errors.push(`saveFetchHistory failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  return result;
}
