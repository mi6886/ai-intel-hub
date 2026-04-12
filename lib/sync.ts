import { DbContentItem } from './db';

interface SyncResult {
  success: boolean;
  pushed: number;
  inserted: number;
  updated: number;
  new_alerts: number;
  errors: string[];
}

/**
 * Push fetched content items to Render's /api/ingest endpoint.
 * Converts DbContentItem[] to IngestItem[] format expected by Render.
 */
export async function pushToRender(
  items: DbContentItem[],
  categoryId: string
): Promise<SyncResult> {
  const renderUrl = process.env.RENDER_API_URL;
  const renderToken = process.env.RENDER_INGEST_TOKEN;

  if (!renderUrl || !renderToken) {
    return {
      success: false,
      pushed: 0,
      inserted: 0,
      updated: 0,
      new_alerts: 0,
      errors: ['RENDER_API_URL or RENDER_INGEST_TOKEN not configured'],
    };
  }

  if (items.length === 0) {
    return { success: true, pushed: 0, inserted: 0, updated: 0, new_alerts: 0, errors: [] };
  }

  // Convert DbContentItem to IngestItem format
  const ingestItems = items.map((item) => ({
    platform: item.platform,
    note_id: item.id.replace(/^xhs-/, ''), // strip prefix
    title: item.title,
    desc: item.summary || '',
    author_name: item.author,
    author_id: '',
    url: item.url,
    cover_image: item.cover_image,
    published_at: item.published_at,
    likes: item.likes,
    comments: item.comments,
    collected: item.collected,
    shares: item.shares,
    matched_rule: {
      type: 'keyword' as const,
      value: item.keyword_text,
    },
  }));

  // Send in batches of 500 to avoid oversized payloads
  const BATCH_SIZE = 500;
  const allErrors: string[] = [];
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalAlerts = 0;

  for (let i = 0; i < ingestItems.length; i += BATCH_SIZE) {
    const batch = ingestItems.slice(i, i + BATCH_SIZE);
    try {
      const response = await fetch(`${renderUrl}/api/ingest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${renderToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: batch,
          category_id: categoryId,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        allErrors.push(`Render API error ${response.status}: ${text}`);
        continue;
      }

      const result = await response.json();
      if (result.success) {
        totalInserted += result.inserted || 0;
        totalUpdated += result.updated || 0;
        totalAlerts += result.new_alerts || 0;
      } else {
        allErrors.push(`Render returned error: ${result.error || 'unknown'}`);
      }
    } catch (error) {
      allErrors.push(`Fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    success: allErrors.length === 0,
    pushed: ingestItems.length,
    inserted: totalInserted,
    updated: totalUpdated,
    new_alerts: totalAlerts,
    errors: allErrors,
  };
}
