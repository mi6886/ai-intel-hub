'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

interface AlertItem {
  id: number;
  title: string;
  author: string;
  platform: string;
  likes: number;
  comments: number;
  collected: number;
  url: string;
  published_at: string;
  triggered_at: string;
  keyword: string;
  is_read: number;
}

interface TweetItem {
  id: string;
  title: string;
  fullText: string;
  author: string;
  url: string;
  likes: number;
  retweets: number;
  replies: number;
  views: number;
  publishedAt: string;
  lang: string;
}

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ===== Calendar Component =====
function Calendar({
  selectedDate,
  onSelect,
  activeDates,
}: {
  selectedDate: string;
  onSelect: (date: string) => void;
  activeDates: Set<string>;
}) {
  const [viewDate, setViewDate] = useState(() => {
    const d = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewDate.year, viewDate.month, 1).getDay();

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  const prevMonth = () => {
    setViewDate((v) => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
  };
  const nextMonth = () => {
    setViewDate((v) => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 });
  };

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="w-64 bg-white rounded-xl shadow-xl border border-gray-200 p-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span className="text-sm font-semibold text-gray-800">{viewDate.year}年{monthNames[viewDate.month]}</span>
        <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {weekdays.map((w) => (
          <div key={w} className="text-center text-[11px] text-gray-400 font-medium py-1">{w}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const dateStr = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          const hasData = activeDates.has(dateStr);

          return (
            <button
              key={dateStr}
              onClick={() => onSelect(dateStr)}
              className={`w-8 h-8 mx-auto flex items-center justify-center rounded-full text-sm transition-all
                ${isSelected
                  ? 'bg-red-500 text-white font-bold'
                  : isToday
                    ? 'ring-1 ring-red-300 font-bold text-gray-800'
                    : hasData
                      ? 'text-gray-800 font-medium hover:bg-gray-100'
                      : 'text-gray-300'
                }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'time' | 'likes'>('time');
  const [activeTab, setActiveTab] = useState<'x' | 'xhs'>('xhs');
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const dateAutoSelected = useRef(false);
  const calRef = useRef<HTMLDivElement>(null);

  const [tweets, setTweets] = useState<TweetItem[]>([]);
  const [twitterDates, setTwitterDates] = useState<string[]>([]);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      if (data.success) {
        setAlerts(data.alerts);
        // Only auto-select date on first load, not when user picks a date
        if (!dateAutoSelected.current && data.alerts.length > 0) {
          dateAutoSelected.current = true;
          const today = new Date().toISOString().split('T')[0];
          const hasToday = data.alerts.some((a: AlertItem) => a.triggered_at.split('T')[0] === today);
          if (!hasToday) {
            const latestDate = data.alerts
              .map((a: AlertItem) => a.triggered_at.split('T')[0])
              .sort()
              .reverse()[0];
            if (latestDate) setDateFilter(latestDate);
          }
        }
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  const loadTweets = useCallback(async (date?: string) => {
    setLoading(true);
    try {
      const url = date ? `/api/twitter?date=${date}` : '/api/twitter';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setTweets(data.tweets);
        if (data.date && !dateFilter) setDateFilter(data.date);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [dateFilter]);

  const loadTwitterDates = useCallback(async () => {
    try {
      const res = await fetch('/api/twitter?datesOnly=true');
      const data = await res.json();
      if (data.success) setTwitterDates(data.dates);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (activeTab === 'xhs') {
      loadAlerts();
    } else {
      loadTwitterDates();
      loadTweets(dateFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Reload tweets when date changes (Twitter tab only)
  useEffect(() => {
    if (activeTab === 'x') {
      loadTweets(dateFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  // Close calendar on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setCalendarOpen(false);
    };
    if (calendarOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [calendarOpen]);

  const markRead = async (alertId: number) => {
    setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, is_read: 1 } : a));
    fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertIds: [alertId] }),
    }).catch(() => {});
  };

  // Dates that have data
  const activeDates = useMemo(() => {
    const set = new Set<string>();
    if (activeTab === 'xhs') {
      for (const a of alerts) {
        const d = a.triggered_at.split('T')[0];
        if (d) set.add(d);
      }
    } else {
      for (const d of twitterDates) set.add(d);
    }
    return set;
  }, [alerts, twitterDates, activeTab]);

  // Filter + sort (XHS alerts)
  const filteredAlerts = alerts
    .filter((a) => {
      if (dateFilter) {
        const trigDate = a.triggered_at.split('T')[0];
        if (trigDate !== dateFilter) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return a.title.toLowerCase().includes(q) ||
          a.author.toLowerCase().includes(q) ||
          (a.keyword && a.keyword.toLowerCase().includes(q));
      }
      return true;
    })
    .sort((a, b) =>
      sortBy === 'likes'
        ? b.likes - a.likes
        : new Date(b.published_at || b.triggered_at).getTime() - new Date(a.published_at || a.triggered_at).getTime()
    );

  // Filter + sort (Twitter)
  const filteredTweets = tweets
    .filter((t) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        return t.title.toLowerCase().includes(q) ||
          t.fullText.toLowerCase().includes(q) ||
          t.author.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) =>
      sortBy === 'likes'
        ? b.likes - a.likes
        : new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

  const currentCount = activeTab === 'xhs' ? filteredAlerts.length : filteredTweets.length;

  const displayDate = (() => {
    const d = new Date(dateFilter + 'T00:00:00');
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  })();

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="py-4 flex items-center" style={{ paddingLeft: 0 }}>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight shrink-0" style={{ marginLeft: '112px' }}>🤖 AI情报中台</h1>
          <button className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'x' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
            style={{ marginLeft: '135px' }}
            onClick={() => setActiveTab('x')}>
            <span className="text-base">𝕏</span> AI热点
          </button>
          <button className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'xhs' ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
            style={{ marginLeft: '148px' }}
            onClick={() => setActiveTab('xhs')}>
            <span className="text-base">📕</span> 小红书爆款
          </button>
          <div className="relative shrink-0" style={{ marginLeft: '175px' }}>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索标题、作者、关键词..."
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-56 transition-colors"
            />
          </div>
          <div className="flex-1" />
        </div>
      </header>

      {/* Main */}
      <main className={activeTab === 'x' ? 'px-0 py-0' : 'max-w-3xl mx-auto px-6 py-6'}>
        {/* Stats bar + filters (XHS only) */}
        {activeTab === 'xhs' && <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-400">
            共 <span className="text-gray-700 font-medium">{currentCount}</span> 条{activeTab === 'xhs' ? '爆款笔记' : '热点推文'}
            {search && <span className="ml-2 text-blue-500">· 搜索: {search}</span>}
          </div>
          <div className="flex items-center gap-4">
            {/* Calendar picker */}
            <div className="relative" ref={calRef}>
              <button
                onClick={() => setCalendarOpen(!calendarOpen)}
                className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 hover:bg-white text-gray-600 transition-colors min-w-[120px]"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
                {displayDate}
              </button>
              {calendarOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 top-9 z-50">
                  <Calendar
                    selectedDate={dateFilter}
                    activeDates={activeDates}
                    onSelect={(d) => {
                      setDateFilter(d);
                      setCalendarOpen(false);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setSortBy('time')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${sortBy === 'time' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                按时间
              </button>
              <button
                onClick={() => setSortBy('likes')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${sortBy === 'likes' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                按点赞
              </button>
            </div>

          </div>
        </div>}

        {/* List */}
        {activeTab === 'x' ? (
          <iframe
            src="/twitter.html"
            className="w-full border-0 rounded-xl"
            style={{ height: 'calc(100vh - 140px)' }}
          />
        ) : loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">加载中...</div>
        ) : currentCount === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-4xl mb-3">📭</div>
            <div className="text-sm">{search ? '没有找到匹配的内容' : '该日期暂无爆款笔记'}</div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            {filteredAlerts.map((alert, idx) => (
              <a
                key={alert.id}
                href={alert.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => markRead(alert.id)}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group"
              >
                <span className="text-sm text-gray-300 w-6 text-right shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium text-gray-800 group-hover:text-blue-600 transition-colors leading-snug truncate">
                    {!alert.is_read && (
                      <span className="inline-block text-[10px] font-bold text-white bg-red-500 rounded px-1 py-0.5 mr-1.5 -translate-y-px">NEW</span>
                    )}
                    {alert.title}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {alert.author}
                    <span className="mx-1.5">·</span>
                    {alert.keyword}
                    <span className="mx-1.5">·</span>
                    {formatDate(alert.published_at)}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs text-gray-400">
                  <span>❤️ {formatNumber(alert.likes)}</span>
                  <span>⭐ {formatNumber(alert.collected)}</span>
                  <span>💬 {formatNumber(alert.comments)}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
