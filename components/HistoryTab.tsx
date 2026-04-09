'use client';

import { useState, useEffect, useCallback } from 'react';
import { MonitorCategory, ALL_PLATFORMS } from '@/data/mockData';

interface TopContent {
  title: string;
  author: string;
  likes: number;
  comments: number;
  url: string;
}

interface HistoryRecord {
  id: number;
  platform: string;
  keyword: string;
  resultCount: number;
  fetchedAt: string;
  topContents: TopContent[];
}

interface DetailContent {
  id: string;
  title: string;
  platform: string;
  author: string;
  likes: number;
  comments: number;
  shares: number;
  collected: number;
  url: string;
}

interface Props {
  category: MonitorCategory;
}

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

function getPlatformInfo(id: string) {
  return ALL_PLATFORMS.find((p) => p.id === id);
}

export default function HistoryTab({ category }: Props) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailContents, setDetailContents] = useState<DetailContent[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ categoryId: category.id });
      if (filterPlatform !== 'all') params.set('platform', filterPlatform);
      if (searchKeyword.trim()) params.set('keyword', searchKeyword.trim());

      const res = await fetch(`/api/history?${params}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.records);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [category.id, filterPlatform, searchKeyword]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const toggleExpand = async (record: HistoryRecord) => {
    if (expandedId === record.id) {
      setExpandedId(null);
      setDetailContents([]);
      return;
    }

    setExpandedId(record.id);
    setDetailLoading(true);
    try {
      const params = new URLSearchParams({
        categoryId: category.id,
        detail: 'true',
        detailKeyword: record.keyword,
        detailPlatform: record.platform,
      });
      const res = await fetch(`/api/history?${params}`);
      const data = await res.json();
      if (data.success) {
        setDetailContents(data.contents);
      }
    } catch {
      // silent
    } finally {
      setDetailLoading(false);
    }
  };

  // Deduplicate: group by platform+keyword, keep latest
  const uniqueRecords = records.reduce<HistoryRecord[]>((acc, r) => {
    const existing = acc.find((a) => a.platform === r.platform && a.keyword === r.keyword);
    if (!existing) acc.push(r);
    return acc;
  }, []);

  return (
    <div className="space-y-4">
      {/* Search & filter bar */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">平台</span>
          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部平台</option>
            {ALL_PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">关键词</span>
          <input
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="搜索关键词..."
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
        </div>
        <span className="text-sm text-gray-400 ml-auto">
          共 {uniqueRecords.length} 条记录
        </span>
      </div>

      {/* History list */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
      ) : uniqueRecords.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📭</div>
          <div className="text-sm">暂无采集记录</div>
          <div className="text-xs text-gray-300 mt-1">在「内容」Tab 中点击「立即采集」开始</div>
        </div>
      ) : (
        <div className="space-y-3">
          {uniqueRecords.map((record) => {
            const platform = getPlatformInfo(record.platform);
            const isExpanded = expandedId === record.id;

            return (
              <div key={record.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:border-gray-200 transition-all">
                {/* Card header */}
                <button
                  onClick={() => toggleExpand(record)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  {platform && (
                    <span
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium text-white shrink-0"
                      style={{ backgroundColor: platform.color }}
                    >
                      {platform.icon} {platform.name}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-gray-800">{record.keyword}</span>
                  <span className="text-sm font-medium text-blue-600 ml-auto shrink-0">{record.resultCount} 条结果</span>
                  <span className="text-xs text-gray-400 shrink-0">{formatTime(record.fetchedAt)}</span>
                  <svg
                    width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                    className={`shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {/* Collapsed: show top 3 preview */}
                {!isExpanded && record.topContents.length > 0 && (
                  <div className="px-4 pb-3 border-t border-gray-50">
                    {record.topContents.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 py-1.5 text-sm">
                        <span className="text-gray-300 w-5 text-right shrink-0">{i + 1}</span>
                        <span className="text-gray-700 truncate flex-1">{c.title}</span>
                        <span className="text-xs text-gray-400 shrink-0">@{c.author}</span>
                        <span className="text-xs text-gray-400 shrink-0">赞 {formatNumber(c.likes)}</span>
                        <span className="text-xs text-gray-400 shrink-0">评 {c.comments}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expanded: full list */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {detailLoading ? (
                      <div className="p-4 text-center text-sm text-gray-400">加载中...</div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {detailContents.map((c, i) => (
                          <a
                            key={c.id}
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                          >
                            <span className="text-gray-300 w-5 text-right text-sm shrink-0">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-800 truncate">{c.title}</div>
                              <div className="text-xs text-gray-400">{c.author}</div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 text-xs text-gray-400">
                              <span>赞 {formatNumber(c.likes)}</span>
                              <span>评 {formatNumber(c.comments)}</span>
                              <span>收藏 {formatNumber(c.collected)}</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
