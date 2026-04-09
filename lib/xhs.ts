import { DbContentItem } from './db';

const XHS_API_URL = 'https://cn8n.com/p2/xhs/search_note_web';

interface XhsNoteInfo {
  noteId: string;
  title: string;
  noteLink: string;
  notePublishTime: string; // "2026-02-24 07:08:00"
  likeNum: number;
  cmtNum: number;
  favNum: number;
  readNum: number;
  noteType: number;
  videoDuration?: number;
  noteImages?: { imageUrl: string; imageWidth: number; imageHeight: number }[];
  isAdNote: number;
}

interface XhsUserInfo {
  nickName: string;
  userId: string;
  avatar: string;
  fansNum: number;
}

interface XhsItem {
  noteInfo: XhsNoteInfo;
  userInfo: XhsUserInfo;
}

interface XhsSearchResponse {
  code: number;
  msg: string;
  data: {
    data: XhsItem[];
  };
}

const RETRY_DELAYS_MS = [10_000, 30_000, 60_000]; // 10s, 30s, 1min

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchXhsOnce(
  body: Record<string, unknown>,
  apiKey: string
): Promise<XhsSearchResponse> {
  const response = await fetch(XHS_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`XHS API error: ${response.status} - ${text}`);
  }

  return response.json();
}

export async function searchXhsNotes(
  keyword: string,
  options?: {
    page?: string;
    sort?: string;
    noteType?: string;
    noteTime?: string;
  }
): Promise<XhsItem[]> {
  const apiKey = process.env.XHS_API_KEY;
  if (!apiKey) {
    throw new Error('XHS_API_KEY environment variable is not set');
  }

  const body = {
    type: 9,
    keyword,
    page: options?.page || '1',
    sort: options?.sort || 'general',
    note_type: options?.noteType || 'note',
    note_time: options?.noteTime || 'day',
    searchId: '',
    sessionId: '',
  };

  let lastError: Error | null = null;

  // First attempt + up to 3 retries
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const result = await fetchXhsOnce(body, apiKey);

      if (result.code === 0) {
        if (!result.data?.data) return [];
        return result.data.data.filter((item) => item.noteInfo && !item.noteInfo.isAdNote);
      }

      if (result.code === 1001) {
        lastError = new Error(`XHS API 不稳定 (code=1001): ${result.msg || '服务暂时不可用'}`);
        if (attempt < RETRY_DELAYS_MS.length) {
          const delay = RETRY_DELAYS_MS[attempt];
          console.log(`[XHS] code=1001, 第${attempt + 1}次重试, ${delay / 1000}秒后重试...`);
          await sleep(delay);
          continue;
        }
      } else {
        throw new Error(`XHS API returned error: code=${result.code}, msg=${result.msg || ''}`);
      }
    } catch (err) {
      if (err instanceof Error && !err.message.includes('code=1001')) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.log(`[XHS] 请求失败, 第${attempt + 1}次重试, ${delay / 1000}秒后重试...`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('XHS API 请求失败，已重试3次');
}

export function mapXhsItemToContentItem(
  item: XhsItem,
  categoryId: string,
  keywordId: string | null,
  keywordText: string
): DbContentItem {
  const { noteInfo, userInfo } = item;

  // Parse "2026-02-24 07:08:00" to ISO string
  let publishedAt: string;
  try {
    publishedAt = new Date(noteInfo.notePublishTime.replace(' ', 'T') + '+08:00').toISOString();
  } catch {
    publishedAt = new Date().toISOString();
  }

  const coverImage = noteInfo.noteImages?.[0]?.imageUrl || '';

  return {
    id: `xhs-${noteInfo.noteId}`,
    category_id: categoryId,
    keyword_id: keywordId,
    keyword_text: keywordText,
    title: noteInfo.title || '(无标题)',
    platform: 'xiaohongshu',
    author: userInfo?.nickName || '未知用户',
    published_at: publishedAt,
    likes: noteInfo.likeNum || 0,
    comments: noteInfo.cmtNum || 0,
    shares: noteInfo.readNum || 0,  // use readNum as shares (XHS doesn't expose share count directly)
    collected: noteInfo.favNum || 0,
    url: noteInfo.noteLink || `https://www.xiaohongshu.com/explore/${noteInfo.noteId}`,
    summary: '',
    cover_image: coverImage,
    note_type: noteInfo.noteType === 2 ? 'video' : 'normal',
    raw_data: JSON.stringify(item),
    fetched_at: new Date().toISOString(),
  };
}
