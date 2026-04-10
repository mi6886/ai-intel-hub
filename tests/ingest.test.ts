import { describe, it, expect, beforeAll } from 'vitest';
import os from 'os';
import path from 'path';
import { processIngestItems, IngestItem } from '@/lib/ingest';
import { getDb } from '@/lib/db';

beforeAll(() => {
  // Use a unique temp file per test run so lib/db.ts's singleton init works.
  // (`:memory:` doesn't play nicely with the seed-copy logic in getDb().)
  process.env.DB_PATH = path.join(os.tmpdir(), `test-ingest-${Date.now()}.db`);
  getDb();
});

describe('processIngestItems', () => {
  const sampleItem: IngestItem = {
    platform: 'xiaohongshu',
    note_id: 'note_123',
    title: 'test title',
    desc: 'test desc',
    author_name: 'tester',
    author_id: 'user_1',
    url: 'https://xhs.com/note_123',
    cover_image: '',
    published_at: new Date().toISOString(),
    likes: 1500,
    comments: 10,
    collected: 5,
    shares: 2,
    matched_rule: { type: 'keyword', value: 'vibecoding' },
  };

  it('returns success with empty array for empty input', () => {
    const result = processIngestItems([], 'cat-1');
    expect(result.success).toBe(true);
    expect(result.inserted).toBe(0);
    expect(result.new_alerts).toBe(0);
  });

  it('inserts one content for valid item', () => {
    const result = processIngestItems([sampleItem], 'cat-1');
    expect(result.success).toBe(true);
    expect(result.inserted).toBe(1);
  });

  it('distinguishes inserted vs updated on repeated ingest', () => {
    const uniqueItem: IngestItem = { ...sampleItem, note_id: 'note_distinct_456' };
    const first = processIngestItems([uniqueItem], 'cat-1');
    expect(first.inserted).toBe(1);
    expect(first.updated).toBe(0);

    const second = processIngestItems([uniqueItem], 'cat-1');
    expect(second.inserted).toBe(0);
    expect(second.updated).toBe(1);
  });
});
