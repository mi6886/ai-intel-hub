import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveMonitorRules, getMonitorRules, createMonitorRule,
  updateMonitorRuleLastRun, toggleMonitorRule, deleteMonitorRule,
  createAlert, saveContents, saveFetchHistory,
} from '@/lib/db';
import { searchXhsNotes, mapXhsItemToContentItem } from '@/lib/xhs';
import { pushToRender } from '@/lib/sync';

// GET: list rules
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId') || undefined;
    const rules = getMonitorRules(categoryId);
    return NextResponse.json({ success: true, rules });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// POST: create rule OR run all active rules
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // If action=run, execute all active rules
    if (body.action === 'run') {
      return await runMonitorRules();
    }

    // Otherwise create a new rule
    const {
      categoryId, keyword, platform = 'xiaohongshu',
      dateFrom, dateTo, likesThreshold = 0,
      commentsThreshold = 0, intervalMinutes = 60,
    } = body;

    if (!categoryId || !keyword) {
      return NextResponse.json({ success: false, error: 'categoryId and keyword are required' }, { status: 400 });
    }

    const id = createMonitorRule({
      category_id: categoryId,
      keyword,
      platform,
      date_from: dateFrom || null,
      date_to: dateTo || null,
      likes_threshold: likesThreshold,
      comments_threshold: commentsThreshold,
      interval_minutes: intervalMinutes,
      enabled: 1,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// PUT: toggle or update rule
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, enabled } = body;
    if (id === undefined) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }
    if (typeof enabled === 'boolean') {
      toggleMonitorRule(id, enabled);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// DELETE: remove rule
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }
    deleteMonitorRule(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// Core: run all active monitor rules
async function runMonitorRules() {
  const rules = getActiveMonitorRules();
  const results: { ruleId: number; keyword: string; newAlerts: number; error?: string }[] = [];
  // Collect all fetched items across rules for batch sync to Render
  const allFetchedItems: { items: ReturnType<typeof mapXhsItemToContentItem>[]; categoryId: string }[] = [];

  for (const rule of rules) {
    try {
      // Check if enough time has passed since last run
      if (rule.last_run_at) {
        const lastRun = new Date(rule.last_run_at).getTime();
        const now = Date.now();
        const intervalMs = rule.interval_minutes * 60 * 1000;
        if (now - lastRun < intervalMs) {
          results.push({ ruleId: rule.id, keyword: rule.keyword, newAlerts: 0, error: '未到执行时间' });
          continue;
        }
      }

      // Fetch from XHS API - 3 pages to maximize coverage
      const allItems = [];
      for (let page = 1; page <= 3; page++) {
        try {
          const pageItems = await searchXhsNotes(rule.keyword, {
            noteTime: '', sort: 'time_descending', page: String(page),
          });
          allItems.push(...pageItems);
          if (pageItems.length < 15) break; // no more pages
        } catch {
          break; // stop on error, keep what we have
        }
      }
      const items = allItems;

      // Map and save to contents table
      const contentItems = items.map((item) =>
        mapXhsItemToContentItem(item, rule.category_id, null, rule.keyword)
      );
      if (contentItems.length > 0) {
        saveContents(contentItems);
        saveFetchHistory({
          category_id: rule.category_id,
          platform: rule.platform,
          keyword: rule.keyword,
          result_count: contentItems.length,
          fetched_at: new Date().toISOString(),
        });
        // Collect for Render sync
        allFetchedItems.push({ items: contentItems, categoryId: rule.category_id });
      }

      // Check thresholds and create alerts
      // Default: only alert on content from last 2 days (today + yesterday)
      const now = new Date();
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const cutoffDate = twoDaysAgo.toISOString().split('T')[0];

      let newAlerts = 0;
      for (const content of contentItems) {
        const pubDate = content.published_at.split('T')[0];

        // Date filter: use rule's date range if set, otherwise default to last 2 days
        if (rule.date_from || rule.date_to) {
          if (rule.date_from && pubDate < rule.date_from) continue;
          if (rule.date_to && pubDate > rule.date_to) continue;
        } else {
          if (pubDate < cutoffDate) continue;
        }

        // Threshold filter
        const meetsLikes = rule.likes_threshold <= 0 || content.likes >= rule.likes_threshold;
        const meetsComments = rule.comments_threshold <= 0 || content.comments >= rule.comments_threshold;

        if (meetsLikes && meetsComments) {
          const alertId = createAlert({
            rule_id: rule.id,
            content_id: content.id,
            title: content.title,
            author: content.author,
            platform: content.platform,
            likes: content.likes,
            comments: content.comments,
            collected: content.collected,
            url: content.url,
            published_at: content.published_at,
            triggered_at: new Date().toISOString(),
            is_read: 0,
          });
          if (alertId !== null) newAlerts++;
        }
      }

      updateMonitorRuleLastRun(rule.id);
      results.push({ ruleId: rule.id, keyword: rule.keyword, newAlerts });
    } catch (error) {
      results.push({
        ruleId: rule.id, keyword: rule.keyword, newAlerts: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Sync all fetched items to Render
  let syncResult = null;
  const allItems = allFetchedItems.flatMap((g) => g.items);
  if (allItems.length > 0) {
    const categoryId = allFetchedItems[0]?.categoryId || 'cat-1';
    try {
      syncResult = await pushToRender(allItems, categoryId);
      console.log(`[Sync] Pushed ${syncResult.pushed} items to Render: inserted=${syncResult.inserted}, updated=${syncResult.updated}, alerts=${syncResult.new_alerts}`);
      if (syncResult.errors.length > 0) {
        console.error('[Sync] Errors:', syncResult.errors);
      }
    } catch (error) {
      console.error('[Sync] Failed:', error);
      syncResult = { success: false, error: String(error) };
    }
  }

  return NextResponse.json({ success: true, results, sync: syncResult });
}
