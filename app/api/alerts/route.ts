import { NextRequest, NextResponse } from 'next/server';
import { getAlerts, getUnreadAlertCount, markAlertsRead } from '@/lib/db';

// GET: list alerts or get unread count
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const countOnly = searchParams.get('countOnly') === 'true';
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    if (countOnly) {
      return NextResponse.json({ success: true, count: getUnreadAlertCount() });
    }

    const alerts = getAlerts({ unreadOnly, limit: 500 });
    return NextResponse.json({ success: true, alerts });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// POST: mark alerts as read
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertIds } = body; // optional: specific IDs, or mark all
    markAlertsRead(alertIds);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
