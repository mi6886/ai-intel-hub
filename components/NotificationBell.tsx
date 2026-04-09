'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Alert {
  id: number;
  keyword: string;
  title: string;
  author: string;
  platform: string;
  likes: number;
  comments: number;
  url: string;
  published_at: string;
  triggered_at: string;
  is_read: number;
}

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts?countOnly=true');
      const data = await res.json();
      if (data.success) setCount(data.count);
    } catch { /* silent */ }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      if (data.success) setAlerts(data.alerts);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  const markAllRead = async () => {
    await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    setCount(0);
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: 1 })));
  };

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [fetchCount]);

  useEffect(() => {
    if (open) fetchAlerts();
  }, [open, fetchAlerts]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">通知</span>
            {count > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-700">全部已读</button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-400">加载中...</div>
            ) : alerts.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <div className="text-3xl mb-2">🔔</div>
                <div className="text-sm">暂无通知</div>
              </div>
            ) : (
              alerts.map((alert) => (
                <a
                  key={alert.id}
                  href={alert.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!alert.is_read ? 'bg-blue-50/50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!alert.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 shrink-0"></span>}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{alert.title}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">📕 小红书</span>
                        <span>关键词: {alert.keyword}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>@{alert.author}</span>
                        <span>❤️ {formatNumber(alert.likes)}</span>
                        <span>💬 {alert.comments}</span>
                        <span className="ml-auto">{timeAgo(alert.triggered_at)}</span>
                      </div>
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
