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
  try {
    saveContents(dbItems);
    result.inserted = dbItems.length;
  } catch (e) {
    result.errors.push(`saveContents failed: ${e}`);
    result.success = false;
    return result;
  }

  // 2. Match against monitor_rules and create alerts
  const now = new Date();
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const cutoffDate = twoDaysAgo.toISOString().split('T')[0];

  const rulesStmt = db.prepare(
    'SELECT id, keyword, likes_threshold, comments_threshold, date_from, date_to FROM monitor_rules WHERE category_id = ? AND enabled = 1 AND keyword = ?'
  );

  for (const item of items) {
    const rules = rulesStmt.all(categoryId, item.matched_rule.value) as Array<{
      id: number;
      keyword: string;
      likes_threshold: number;
      comments_threshold: number;
      date_from: string | null;
      date_to: string | null;
    }>;

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

  // 3. Record fetch history
  try {
    saveFetchHistory({
      category_id: categoryId,
      platform: 'xiaohongshu',
      keyword: 'mediacrawler-batch',
      result_count: items.length,
      fetched_at: new Date().toISOString(),
    });
  } catch (e) {
    result.errors.push(`saveFetchHistory failed: ${e}`);
  }

  return result;
}
