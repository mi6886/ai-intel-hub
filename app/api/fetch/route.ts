import { NextRequest, NextResponse } from 'next/server';
import { searchXhsNotes, mapXhsItemToContentItem } from '@/lib/xhs';
import { saveContents, saveFetchHistory } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { categoryId, keyword, platform, keywordId } = body;

    if (!categoryId || !keyword) {
      return NextResponse.json(
        { success: false, error: 'categoryId and keyword are required' },
        { status: 400 }
      );
    }

    if (platform && platform !== 'xiaohongshu') {
      return NextResponse.json(
        { success: false, error: `Platform "${platform}" is not yet supported. Only xiaohongshu is available.` },
        { status: 400 }
      );
    }

    // Fetch from XHS API
    const notes = await searchXhsNotes(keyword);

    // Map to DB format
    const items = notes.map((item) =>
      mapXhsItemToContentItem(item, categoryId, keywordId || null, keyword)
    );

    // Save to SQLite
    const saved = saveContents(items);

    // Record fetch history
    saveFetchHistory({
      category_id: categoryId,
      platform: 'xiaohongshu',
      keyword,
      result_count: items.length,
      fetched_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      fetched: items.length,
      saved,
      platform: 'xiaohongshu',
      keyword,
      items: items.map(({ raw_data, ...rest }) => rest), // exclude raw_data from response
    });
  } catch (error) {
    console.error('Fetch error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
