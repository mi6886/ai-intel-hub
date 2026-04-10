import { NextRequest, NextResponse } from 'next/server';
import { processIngestItems, IngestItem } from '@/lib/ingest';

export async function POST(request: NextRequest) {
  // 1. Verify bearer token
  const authHeader = request.headers.get('authorization') || '';
  const expectedToken = process.env.INGEST_TOKEN;
  if (!expectedToken) {
    return NextResponse.json(
      { success: false, error: 'INGEST_TOKEN not configured on server' },
      { status: 500 }
    );
  }
  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // 2. Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON' },
      { status: 400 }
    );
  }

  const { items, category_id } = body as {
    source?: string;
    category_id?: string;
    items?: IngestItem[];
  };

  if (!items || !Array.isArray(items)) {
    return NextResponse.json(
      { success: false, error: 'items must be an array' },
      { status: 400 }
    );
  }

  if (items.length > 5000) {
    return NextResponse.json(
      { success: false, error: 'batch too large, max 5000 items' },
      { status: 400 }
    );
  }

  const catId = category_id || 'cat-1';

  // 3. Process
  try {
    const result = processIngestItems(items, catId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Ingest error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
