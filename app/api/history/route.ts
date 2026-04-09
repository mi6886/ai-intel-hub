import { NextRequest, NextResponse } from 'next/server';
import { getFetchHistory, getContentsByFetchKeyword } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId') || undefined;
    const platform = searchParams.get('platform') || undefined;
    const keyword = searchParams.get('keyword') || undefined;
    const detail = searchParams.get('detail') === 'true';
    const detailKeyword = searchParams.get('detailKeyword') || undefined;
    const detailPlatform = searchParams.get('detailPlatform') || undefined;

    // Detail mode: return all contents for a specific keyword+platform
    if (detail && categoryId && detailKeyword && detailPlatform) {
      const contents = getContentsByFetchKeyword(categoryId, detailPlatform, detailKeyword);
      return NextResponse.json({
        success: true,
        contents: contents.map((c) => ({
          id: c.id,
          title: c.title,
          platform: c.platform,
          author: c.author,
          publishedAt: c.published_at,
          likes: c.likes,
          comments: c.comments,
          shares: c.shares,
          collected: c.collected,
          url: c.url,
          summary: c.summary,
        })),
      });
    }

    // List mode: return fetch history with top 3 contents
    const histories = getFetchHistory({ categoryId, platform, keyword });

    return NextResponse.json({
      success: true,
      records: histories.map((h) => ({
        id: h.id,
        platform: h.platform,
        keyword: h.keyword,
        resultCount: h.result_count,
        fetchedAt: h.fetched_at,
        topContents: h.top_contents.map((c) => ({
          title: c.title,
          author: c.author,
          likes: c.likes,
          comments: c.comments,
          url: c.url,
        })),
      })),
    });
  } catch (error) {
    console.error('History query error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
