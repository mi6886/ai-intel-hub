import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const TWITTER_DATA_DIR = process.env.TWITTER_DATA_DIR || path.join(process.cwd(), 'public', 'twitter-data');

interface Tweet {
  tweet_id: string;
  url: string;
  screen_name: string;
  created_at: string;
  full_text: string;
  lang: string;
  favorite_count: number;
  retweet_count: number;
  reply_count: number;
  view_count: number;
  quoted_tweet_text: string;
  media: unknown[];
}

interface FinalFile {
  date: string;
  period: string;
  tweets: Tweet[];
}

function getAvailableDates(): string[] {
  try {
    const files = fs.readdirSync(TWITTER_DATA_DIR);
    const dates = new Set<string>();
    for (const f of files) {
      const match = f.match(/^final-(\d{4}-\d{2}-\d{2})/);
      if (match) dates.add(match[1]);
    }
    return Array.from(dates).sort().reverse();
  } catch {
    return [];
  }
}

function loadTweetsForDate(date: string): { tweets: Tweet[]; period: string }[] {
  const results: { tweets: Tweet[]; period: string }[] = [];
  for (const period of ['morning', 'evening']) {
    const filePath = path.join(TWITTER_DATA_DIR, `final-${date}-${period}.json`);
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data: FinalFile = JSON.parse(raw);
        if (data.tweets && data.tweets.length > 0) {
          results.push({ tweets: data.tweets, period });
        }
      }
    } catch {
      // skip
    }
  }
  return results;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const datesOnly = searchParams.get('datesOnly') === 'true';

    if (datesOnly) {
      return NextResponse.json({ success: true, dates: getAvailableDates() });
    }

    // If no date, use latest available
    const targetDate = date || getAvailableDates()[0];
    if (!targetDate) {
      return NextResponse.json({ success: true, tweets: [] });
    }

    const results = loadTweetsForDate(targetDate);
    const allTweets = results.flatMap((r) => r.tweets);

    // Map to a unified format
    const items = allTweets.map((t) => ({
      id: t.tweet_id,
      title: t.full_text.slice(0, 120) + (t.full_text.length > 120 ? '...' : ''),
      fullText: t.full_text,
      author: t.screen_name,
      url: t.url,
      likes: t.favorite_count,
      retweets: t.retweet_count,
      replies: t.reply_count,
      views: t.view_count,
      publishedAt: t.created_at,
      lang: t.lang,
    }));

    // Sort by likes descending
    items.sort((a, b) => b.likes - a.likes);

    return NextResponse.json({
      success: true,
      date: targetDate,
      count: items.length,
      tweets: items,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
