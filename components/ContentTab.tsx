'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { MonitorCategory, ALL_PLATFORMS, ContentItem } from '@/data/mockData';
import PlatformFilter from './PlatformFilter';
import DateScroller from './DateScroller';

interface Props {
  category: MonitorCategory;
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function getDateStr(iso: string): string {
  return iso.split('T')[0];
}

function getPlatformInfo(id: string) {
  return ALL_PLATFORMS.find((p) => p.id === id);
}

export default function ContentTab({ category }: Props) {
  const [activePlatform, setActivePlatform] = useState('all');
  const [apiContents, setApiContents] = useState<ContentItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState('');

  // Merge mock contents + API contents
  const allContents = useMemo(() => {
    const merged = [...category.contents];
    for (const item of apiContents) {
      if (!merged.find((m) => m.id === item.id)) {
        merged.push(item);
      }
    }
    return merged;
  }, [category.contents, apiContents]);

  // Load API data on mount and when category changes
  useEffect(() => {
    loadApiContents();
  }, [category.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadApiContents = useCallback(async () => {
    try {
      const res = await fetch(`/api/contents?categoryId=${category.id}`);
      const data = await res.json();
      if (data.success && data.contents) {
        setApiContents(data.contents.map((c: Record<string, unknown>) => ({
          id: c.id as string,
          title: c.title as string,
          platform: c.platform as string,
          author: c.author as string,
          publishedAt: c.publishedAt as string,
          likes: c.likes as number,
          comments: c.comments as number,
          shares: c.shares as number,
          collected: (c.collected as number) || 0,
          url: c.url as string,
          summary: c.summary as string,
          fetchedAt: c.fetchedAt as string,
        })));
      }
    } catch {
      // silently fail - mock data is still available
    }
  }, [category.id]);

  // Get available dates sorted descending
  const dateMap = useMemo(() => {
    const map: Record<string, ContentItem[]> = {};
    for (const c of allContents) {
      const d = getDateStr(c.publishedAt);
      if (!map[d]) map[d] = [];
      map[d].push(c);
    }
    return map;
  }, [allContents]);

  const sortedDates = useMemo(() => Object.keys(dateMap).sort((a, b) => b.localeCompare(a)), [dateMap]);

  const [activeDate, setActiveDate] = useState('');

  // Set initial active date
  useEffect(() => {
    if (sortedDates.length > 0 && !sortedDates.includes(activeDate)) {
      setActiveDate(sortedDates[0]);
    }
  }, [sortedDates, activeDate]);

  // Platform content counts for active date
  const platformCounts = useMemo(() => {
    const items = dateMap[activeDate] || [];
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.platform] = (counts[item.platform] || 0) + 1;
    }
    return counts;
  }, [dateMap, activeDate]);

  // Date cards with counts (filtered by platform)
  const dateCards = useMemo(() => {
    return sortedDates.map((d) => ({
      date: d,
      count: dateMap[d].filter((c) => activePlatform === 'all' || c.platform === activePlatform).length,
    }));
  }, [sortedDates, dateMap, activePlatform]);

  // Filtered content
  const filteredContent = useMemo(() => {
    let items = dateMap[activeDate] || [];
    if (activePlatform !== 'all') {
      items = items.filter((c) => c.platform === activePlatform);
    }
    return items.sort((a, b) => b.likes - a.likes);
  }, [dateMap, activeDate, activePlatform]);

  // Last fetch time from API data
  const lastFetchInfo = useMemo(() => {
    if (apiContents.length === 0) return null;
    const latest = apiContents.reduce((max, c) => {
      const t = (c as { fetchedAt?: string }).fetchedAt || '';
      return t > (max || '') ? t : max;
    }, '');
    if (!latest) return null;
    const d = new Date(latest);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }, [apiContents]);

  // Get XHS-enabled keywords for refresh
  const xhsKeywords = useMemo(() => {
    return category.keywords.filter((kw) => kw.enabled && kw.platforms.includes('xiaohongshu'));
  }, [category.keywords]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    const keyword = selectedKeyword || (xhsKeywords.length > 0 ? xhsKeywords[0].keyword : '');
    if (!keyword) {
      setRefreshResult({ message: '请先在监控设置中添加包含小红书的关键词', type: 'error' });
      return;
    }

    setRefreshing(true);
    setRefreshResult(null);

    try {
      const res = await fetch('/api/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: category.id,
          keyword,
          platform: 'xiaohongshu',
        }),
      });

      const data = await res.json();

      if (data.success) {
        setRefreshResult({ message: `成功采集 ${data.fetched} 条小红书内容 (关键词: ${keyword})`, type: 'success' });
        await loadApiContents();
      } else {
        setRefreshResult({ message: data.error || '采集失败', type: 'error' });
      }
    } catch (err) {
      setRefreshResult({ message: err instanceof Error ? err.message : '网络错误', type: 'error' });
    } finally {
      setRefreshing(false);
    }
  }, [category.id, selectedKeyword, xhsKeywords, loadApiContents]);

  return (
    <div className="space-y-5">
      {/* Refresh bar */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">快速采集</span>
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: '#FF2442' }}>
              📕 小红书
            </span>
          </div>
          <select
            value={selectedKeyword}
            onChange={(e) => setSelectedKeyword(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[140px]"
          >
            <option value="">
              {xhsKeywords.length > 0 ? `默认: ${xhsKeywords[0].keyword}` : '无可用关键词'}
            </option>
            {xhsKeywords.map((kw) => (
              <option key={kw.id} value={kw.keyword}>{kw.keyword}</option>
            ))}
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing || xhsKeywords.length === 0}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all
              ${refreshing
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              className={refreshing ? 'animate-spin' : ''}>
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            {refreshing ? '采集中...' : '更新数据'}
          </button>
          {lastFetchInfo && (
            <span className="text-xs text-gray-400">上次采集: {lastFetchInfo} · 已有 {apiContents.length} 条</span>
          )}
          {!lastFetchInfo && xhsKeywords.length === 0 && (
            <span className="text-xs text-amber-600">请先在监控设置中添加包含小红书的关键词</span>
          )}
        </div>
        {refreshResult && (
          <div className={`mt-2 text-sm px-3 py-1.5 rounded-lg ${
            refreshResult.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}>
            {refreshResult.type === 'success' ? '✅' : '❌'} {refreshResult.message}
          </div>
        )}
      </div>

      {/* Date scroller */}
      <DateScroller
        dates={dateCards}
        activeDate={activeDate}
        onSelect={setActiveDate}
        label="选择日期查看内容"
      />

      {/* Platform filter */}
      <PlatformFilter
        platforms={category.platforms}
        activePlatform={activePlatform}
        onSelect={setActivePlatform}
        contentCounts={platformCounts}
      />

      {/* Content count */}
      <div className="text-sm text-gray-500">
        共 <span className="font-semibold text-gray-700">{filteredContent.length}</span> 条内容
      </div>

      {/* Content list */}
      <div className="space-y-3">
        {filteredContent.map((item) => {
          const platform = getPlatformInfo(item.platform);
          return (
            <a
              key={item.id}
              href={item.url !== '#' ? item.url : undefined}
              target={item.url !== '#' ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="block bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    {platform && (
                      <span
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium text-white"
                        style={{ backgroundColor: platform.color }}
                      >
                        {platform.icon} {platform.name}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{formatTime(item.publishedAt)}</span>
                  </div>
                  <h3 className="text-[15px] font-semibold text-gray-800 mb-1.5 group-hover:text-blue-600 transition-colors leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{item.summary}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-xs text-gray-400">@{item.author}</span>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        {formatNumber(item.likes)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        {formatNumber(item.comments)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                        {formatNumber(item.shares)}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Heat indicator */}
                <div className="shrink-0 flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                    ${item.likes >= 30000 ? 'bg-red-50 text-red-600' :
                      item.likes >= 10000 ? 'bg-orange-50 text-orange-600' :
                      item.likes >= 5000 ? 'bg-yellow-50 text-yellow-600' :
                      'bg-gray-50 text-gray-500'}`}>
                    {item.likes >= 30000 ? '🔥' : item.likes >= 10000 ? '🔶' : item.likes >= 5000 ? '📈' : '·'}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1">
                    {item.likes >= 30000 ? '爆热' : item.likes >= 10000 ? '高热' : item.likes >= 5000 ? '热门' : '一般'}
                  </span>
                </div>
              </div>
            </a>
          );
        })}

        {filteredContent.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📭</div>
            <div className="text-sm">该日期暂无内容</div>
            {xhsKeywords.length > 0 && (
              <button
                onClick={handleRefresh}
                className="mt-3 text-sm text-blue-600 hover:text-blue-700"
              >
                点击采集小红书内容
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
