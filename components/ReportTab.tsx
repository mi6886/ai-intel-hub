'use client';

import { useState, useMemo } from 'react';
import { MonitorCategory, DailyReport, TopicSuggestion } from '@/data/mockData';

interface Props {
  category: MonitorCategory;
}

type ViewMode = 'timeline' | 'topics';

function formatReportDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  return `${months[d.getMonth()]}${d.getDate()}日 ${weekdays[d.getDay()]}`;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 90 ? 'bg-red-50 text-red-600 border-red-200' :
                score >= 80 ? 'bg-orange-50 text-orange-600 border-orange-200' :
                score >= 70 ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                'bg-gray-50 text-gray-500 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${color}`}>
      {score}分
    </span>
  );
}

function TopicCard({ topic, index }: { topic: TopicSuggestion; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all overflow-hidden">
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
              <ScoreBadge score={topic.score} />
            </div>
            <h4 className="text-[15px] font-semibold text-gray-800 mb-1">{topic.title}</h4>
            <p className="text-sm text-gray-500">{topic.description}</p>
          </div>
          <button className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-1">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">为什么做这个选题</div>
            <p className="text-sm text-gray-600 leading-relaxed">{topic.whyDoThis}</p>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">爆点与增长空间</div>
            <p className="text-sm text-gray-600 leading-relaxed">{topic.growthPotential}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportDetail({ report }: { report: DailyReport }) {
  return (
    <div className="space-y-5">
      {/* Summary card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🤖</span>
          <span className="text-sm font-semibold text-blue-700">AI 分析摘要</span>
          <span className="text-xs text-blue-400">· 基于 {report.contentAnalyzed} 条热门内容</span>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{report.summary}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {report.hotTopics.map((t, i) => (
            <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/80 text-blue-600 border border-blue-100">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Topic suggestions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          选题建议 <span className="text-gray-400 font-normal">({report.topicSuggestions.length}个)</span>
        </h3>
        <div className="space-y-3">
          {report.topicSuggestions.map((topic, idx) => (
            <TopicCard key={topic.id} topic={topic} index={idx} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ReportTab({ category }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');

  const sortedReports = useMemo(() => {
    return [...category.reports].sort((a, b) => b.date.localeCompare(a.date));
  }, [category.reports]);

  const [activeReportDate, setActiveReportDate] = useState(sortedReports[0]?.date || '');
  const activeReport = sortedReports.find((r) => r.date === activeReportDate);

  // All topics aggregated (for topics view)
  const allTopics = useMemo(() => {
    return sortedReports.flatMap((r) =>
      r.topicSuggestions.map((t) => ({ ...t, reportDate: r.date }))
    ).sort((a, b) => b.score - a.score);
  }, [sortedReports]);

  return (
    <div className="space-y-5">
      {/* View mode toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode('timeline')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${viewMode === 'timeline' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          📅 按日期查看
        </button>
        <button
          onClick={() => setViewMode('topics')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${viewMode === 'topics' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          💡 选题汇总
        </button>
      </div>

      {viewMode === 'timeline' ? (
        <div className="flex gap-5">
          {/* Date list sidebar */}
          <div className="w-56 shrink-0 space-y-1.5">
            {sortedReports.map((report) => {
              const isActive = report.date === activeReportDate;
              return (
                <button
                  key={report.date}
                  onClick={() => setActiveReportDate(report.date)}
                  className={`w-full text-left p-3 rounded-xl transition-all
                    ${isActive
                      ? 'bg-blue-50 border-blue-200 border shadow-sm'
                      : 'bg-white border border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  <div className={`text-sm font-semibold ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>
                    {formatReportDate(report.date)}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {report.topicSuggestions.length} 个选题 · {report.contentAnalyzed} 条分析
                  </div>
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                    {report.summary.slice(0, 50)}...
                  </div>
                </button>
              );
            })}
          </div>

          {/* Report detail */}
          <div className="flex-1 min-w-0">
            {activeReport ? (
              <ReportDetail report={activeReport} />
            ) : (
              <div className="text-center py-16 text-gray-400">
                <div className="text-4xl mb-3">📊</div>
                <div className="text-sm">选择一个日期查看报告</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Topics aggregation view */
        <div>
          <div className="text-sm text-gray-500 mb-3">
            最近 {sortedReports.length} 天共 <span className="font-semibold text-gray-700">{allTopics.length}</span> 个选题建议，按推荐度排序
          </div>
          <div className="space-y-3">
            {allTopics.map((topic, idx) => (
              <div key={topic.id}>
                <div className="text-[10px] text-gray-400 mb-1 ml-1">
                  来自 {formatReportDate(topic.reportDate)} 的报告
                </div>
                <TopicCard topic={topic} index={idx} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
