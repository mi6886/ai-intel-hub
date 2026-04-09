import { NextRequest, NextResponse } from 'next/server';
import { getContents, getContentDates } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId') || undefined;
    const platform = searchParams.get('platform') || undefined;
    const date = searchParams.get('date') || undefined;
    const keyword = searchParams.get('keyword') || undefined;
    const datesOnly = searchParams.get('datesOnly') === 'true';

    if (datesOnly && categoryId) {
      const dates = getContentDates(categoryId, platform);
      return NextResponse.json({ success: true, dates });
    }

    const items = getContents({ categoryId, platform, date, keyword });

    // Map DB items to frontend ContentItem format
    const contents = items.map((item) => ({
      id: item.id,
      title: item.title,
      platform: item.platform,
      author: item.author,
      publishedAt: item.published_at,
      likes: item.likes,
      comments: item.comments,
      shares: item.shares,
      collected: item.collected,
      url: item.url,
      summary: item.summary,
      coverImage: item.cover_image,
      keywordText: item.keyword_text,
      fetchedAt: item.fetched_at,
    }));

    return NextResponse.json({ success: true, contents });
  } catch (error) {
    console.error('Contents query error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
