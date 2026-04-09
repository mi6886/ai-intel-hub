'use client';

import { useState, useEffect, useCallback } from 'react';
import { MonitorCategory, ALL_PLATFORMS, MonitorKeyword, MonitorBlogger } from '@/data/mockData';

interface Props {
  category: MonitorCategory;
  onUpdate: (category: MonitorCategory) => void;
}

function PlatformBadge({ platformId, size = 'sm' }: { platformId: string; size?: 'sm' | 'md' }) {
  const p = ALL_PLATFORMS.find((pl) => pl.id === platformId);
  if (!p) return <span className="text-xs text-gray-400">{platformId}</span>;
  const cls = size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-white font-medium ${cls}`} style={{ backgroundColor: p.color }}>
      {p.icon} {p.name}
    </span>
  );
}

// ===== Monitor Rules Sub-component =====
interface MonitorRule {
  id: number;
  keyword: string;
  platform: string;
  date_from: string | null;
  date_to: string | null;
  likes_threshold: number;
  interval_minutes: number;
  enabled: number;
  last_run_at: string | null;
  created_at: string;
}

function MonitorRulesSection({ categoryId }: { categoryId: string }) {
  const [rules, setRules] = useState<MonitorRule[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newRule, setNewRule] = useState({
    keyword: '', dateFrom: '', dateTo: '', likesThreshold: 1000, intervalMinutes: 60,
  });
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    try {
      const res = await fetch(`/api/monitor?categoryId=${categoryId}`);
      const data = await res.json();
      if (data.success) setRules(data.rules);
    } catch { /* silent */ }
  }, [categoryId]);

  useEffect(() => { loadRules(); }, [loadRules]);

  const handleAdd = async () => {
    if (!newRule.keyword.trim()) return;
    await fetch('/api/monitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId,
        keyword: newRule.keyword.trim(),
        platform: 'xiaohongshu',
        dateFrom: newRule.dateFrom || undefined,
        dateTo: newRule.dateTo || undefined,
        likesThreshold: newRule.likesThreshold,
        intervalMinutes: newRule.intervalMinutes,
      }),
    });
    setNewRule({ keyword: '', dateFrom: '', dateTo: '', likesThreshold: 1000, intervalMinutes: 60 });
    setShowAdd(false);
    loadRules();
  };

  const handleToggle = async (id: number, enabled: boolean) => {
    await fetch('/api/monitor', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    });
    loadRules();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/monitor?id=${id}`, { method: 'DELETE' });
    loadRules();
  };

  const handleRunAll = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run' }),
      });
      const data = await res.json();
      if (data.success) {
        const total = data.results.reduce((s: number, r: { newAlerts: number }) => s + r.newAlerts, 0);
        setRunResult(`执行完成，发现 ${total} 条新通知`);
      } else {
        setRunResult('执行失败');
      }
      loadRules();
    } catch {
      setRunResult('网络错误');
    } finally {
      setRunning(false);
    }
  };

  const platformInfo = (id: string) => ALL_PLATFORMS.find((p) => p.id === id);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span className="w-1 h-4 bg-red-500 rounded-full"></span>
          监控告警规则
          <span className="text-gray-400 font-normal">({rules.length})</span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunAll}
            disabled={running || rules.length === 0}
            className="text-xs px-3 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            {running ? '执行中...' : '▶ 立即执行全部'}
          </button>
          <button onClick={() => setShowAdd(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            + 添加规则
          </button>
        </div>
      </div>

      {runResult && (
        <div className="mb-3 text-sm px-3 py-2 rounded-lg bg-green-50 text-green-700 border border-green-100">
          ✅ {runResult}
        </div>
      )}

      {showAdd && (
        <div className="bg-red-50 rounded-xl p-4 mb-3 space-y-3 border border-red-100">
          <div className="grid grid-cols-2 gap-3">
            <input
              autoFocus
              value={newRule.keyword}
              onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })}
              placeholder="监控关键词（如 OpenClaw）"
              className="col-span-2 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div>
              <label className="text-xs text-gray-500 mb-1 block">开始日期</label>
              <input
                type="date" value={newRule.dateFrom}
                onChange={(e) => setNewRule({ ...newRule, dateFrom: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">结束日期</label>
              <input
                type="date" value={newRule.dateTo}
                onChange={(e) => setNewRule({ ...newRule, dateTo: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">点赞阈值</label>
              <input
                type="number" value={newRule.likesThreshold}
                onChange={(e) => setNewRule({ ...newRule, likesThreshold: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">检查频率（分钟）</label>
              <input
                type="number" value={newRule.intervalMinutes}
                onChange={(e) => setNewRule({ ...newRule, intervalMinutes: parseInt(e.target.value) || 60 })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!newRule.keyword.trim()} className="px-4 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">添加</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-1.5 text-gray-500 text-sm hover:text-gray-700">取消</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rules.map((rule) => {
          const p = platformInfo(rule.platform);
          return (
            <div key={rule.id} className={`p-3 rounded-xl border transition-all ${rule.enabled ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => handleToggle(rule.id, !rule.enabled)}
                    className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${rule.enabled ? 'bg-red-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${rule.enabled ? 'left-4' : 'left-0.5'}`} />
                  </button>
                  {p && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: p.color }}>
                      {p.icon} {p.name}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-gray-800">{rule.keyword}</span>
                  <span className="text-xs text-gray-400">
                    赞≥{rule.likes_threshold} · 每{rule.interval_minutes}分钟
                    {rule.date_from && ` · ${rule.date_from}`}
                    {rule.date_to && ` ~ ${rule.date_to}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {rule.last_run_at && (
                    <span className="text-[10px] text-gray-400">
                      上次: {new Date(rule.last_run_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <button onClick={() => handleDelete(rule.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function SettingsTab({ category, onUpdate }: Props) {
  const [showAddKeyword, setShowAddKeyword] = useState(false);
  const [showAddBlogger, setShowAddBlogger] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newKeywordPlatforms, setNewKeywordPlatforms] = useState<string[]>([...category.platforms]);
  const [newBloggerName, setNewBloggerName] = useState('');
  const [newBloggerPlatform, setNewBloggerPlatform] = useState('douyin');
  const [newBloggerId, setNewBloggerId] = useState('');

  const toggleKeyword = (id: string) => {
    const updated = {
      ...category,
      keywords: category.keywords.map((kw) =>
        kw.id === id ? { ...kw, enabled: !kw.enabled } : kw
      ),
    };
    onUpdate(updated);
  };

  const toggleBlogger = (id: string) => {
    const updated = {
      ...category,
      bloggers: category.bloggers.map((bl) =>
        bl.id === id ? { ...bl, enabled: !bl.enabled } : bl
      ),
    };
    onUpdate(updated);
  };

  const toggleNewKeywordPlatform = (platformId: string) => {
    setNewKeywordPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
  };

  const toggleAllPlatforms = () => {
    const allIds = ALL_PLATFORMS.map((p) => p.id);
    if (newKeywordPlatforms.length === allIds.length) {
      setNewKeywordPlatforms([]);
    } else {
      setNewKeywordPlatforms([...allIds]);
    }
  };

  const addKeyword = () => {
    if (!newKeyword.trim() || newKeywordPlatforms.length === 0) return;
    const kw: MonitorKeyword = {
      id: `kw-${Date.now()}`,
      keyword: newKeyword.trim(),
      platforms: [...newKeywordPlatforms],
      enabled: true,
    };
    onUpdate({ ...category, keywords: [...category.keywords, kw] });
    setNewKeyword('');
    setNewKeywordPlatforms([...category.platforms]);
    setShowAddKeyword(false);
  };

  const addBlogger = () => {
    if (!newBloggerName.trim()) return;
    const bl: MonitorBlogger = {
      id: `bl-${Date.now()}`,
      name: newBloggerName.trim(),
      platform: newBloggerPlatform,
      platformId: newBloggerId || newBloggerName.trim(),
      avatar: '👤',
      followers: '未知',
      enabled: true,
    };
    onUpdate({ ...category, bloggers: [...category.bloggers, bl] });
    setNewBloggerName('');
    setNewBloggerId('');
    setShowAddBlogger(false);
  };

  const removeKeyword = (id: string) => {
    onUpdate({ ...category, keywords: category.keywords.filter((kw) => kw.id !== id) });
  };

  const removeBlogger = (id: string) => {
    onUpdate({ ...category, bloggers: category.bloggers.filter((bl) => bl.id !== id) });
  };

  const isAllPlatforms = (platforms: string[]) => {
    return ALL_PLATFORMS.every((p) => platforms.includes(p.id));
  };

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Monitoring platforms */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-1 h-4 bg-blue-600 rounded-full"></span>
          监控平台
        </h3>
        <div className="flex flex-wrap gap-2">
          {ALL_PLATFORMS.map((p) => {
            const enabled = category.platforms.includes(p.id);
            return (
              <button
                key={p.id}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border
                  ${enabled
                    ? 'text-white border-transparent shadow-sm'
                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                  }`}
                style={enabled ? { backgroundColor: p.color } : {}}
              >
                <span className="text-base">{p.icon}</span>
                {p.name}
                {enabled && (
                  <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" className="ml-1 opacity-80">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Keywords */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
            对标关键词
            <span className="text-gray-400 font-normal">({category.keywords.length})</span>
          </h3>
          <button
            onClick={() => setShowAddKeyword(true)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + 添加关键词
          </button>
        </div>

        {showAddKeyword && (
          <div className="bg-blue-50 rounded-xl p-4 mb-3 space-y-3 border border-blue-100">
            <input
              autoFocus
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
              placeholder="输入关键词..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">选择监控平台</span>
                <button
                  onClick={toggleAllPlatforms}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  {newKeywordPlatforms.length === ALL_PLATFORMS.length ? '取消全选' : '全选'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_PLATFORMS.map((p) => {
                  const selected = newKeywordPlatforms.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleNewKeywordPlatform(p.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border
                        ${selected
                          ? 'text-white border-transparent'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                        }`}
                      style={selected ? { backgroundColor: p.color } : {}}
                    >
                      <span>{p.icon}</span>
                      {p.name}
                      {selected && (
                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24" className="opacity-80">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              {newKeywordPlatforms.length === 0 && (
                <p className="text-xs text-red-500 mt-1">请至少选择一个平台</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={addKeyword}
                disabled={!newKeyword.trim() || newKeywordPlatforms.length === 0}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                添加
              </button>
              <button onClick={() => { setShowAddKeyword(false); setNewKeyword(''); }} className="px-4 py-1.5 text-gray-500 text-sm hover:text-gray-700">取消</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {category.keywords.map((kw) => (
            <div
              key={kw.id}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all
                ${kw.enabled ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100 opacity-60'}`}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => toggleKeyword(kw.id)}
                  className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${kw.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${kw.enabled ? 'left-4' : 'left-0.5'}`} />
                </button>
                <span className={`text-sm font-medium ${kw.enabled ? 'text-gray-800' : 'text-gray-400'}`}>{kw.keyword}</span>
                <div className="flex flex-wrap gap-1">
                  {isAllPlatforms(kw.platforms) ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">全平台</span>
                  ) : (
                    kw.platforms.map((pid) => (
                      <PlatformBadge key={pid} platformId={pid} />
                    ))
                  )}
                </div>
              </div>
              <button onClick={() => removeKeyword(kw.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1 shrink-0">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Bloggers */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
            对标博主/账号
            <span className="text-gray-400 font-normal">({category.bloggers.length})</span>
          </h3>
          <button
            onClick={() => setShowAddBlogger(true)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + 添加博主
          </button>
        </div>

        {showAddBlogger && (
          <div className="bg-purple-50 rounded-xl p-4 mb-3 space-y-3 border border-purple-100">
            <div className="grid grid-cols-3 gap-3">
              <input
                autoFocus
                value={newBloggerName}
                onChange={(e) => setNewBloggerName(e.target.value)}
                placeholder="博主名称..."
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <select
                value={newBloggerPlatform}
                onChange={(e) => setNewBloggerPlatform(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              >
                {ALL_PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                value={newBloggerId}
                onChange={(e) => setNewBloggerId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addBlogger()}
                placeholder="平台ID（选填）"
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={addBlogger} className="px-4 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors">添加</button>
              <button onClick={() => setShowAddBlogger(false)} className="px-4 py-1.5 text-gray-500 text-sm hover:text-gray-700">取消</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {category.bloggers.map((bl) => (
            <div
              key={bl.id}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all
                ${bl.enabled ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100 opacity-60'}`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleBlogger(bl.id)}
                  className={`w-9 h-5 rounded-full transition-colors relative ${bl.enabled ? 'bg-purple-600' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${bl.enabled ? 'left-4' : 'left-0.5'}`} />
                </button>
                <span className="text-xl">{bl.avatar}</span>
                <div>
                  <div className={`text-sm font-medium ${bl.enabled ? 'text-gray-800' : 'text-gray-400'}`}>{bl.name}</div>
                  <div className="text-[10px] text-gray-400">{bl.platformId} · {bl.followers} 粉丝</div>
                </div>
                <PlatformBadge platformId={bl.platform} />
              </div>
              <button onClick={() => removeBlogger(bl.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Monitor Rules */}
      <MonitorRulesSection categoryId={category.id} />

      {/* Schedule info */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-1 h-4 bg-green-500 rounded-full"></span>
          执行计划
        </h3>
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <svg width="16" height="16" fill="none" stroke="#16a34a" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-800">每天 08:00 自动执行</div>
              <div className="text-xs text-gray-500">系统将自动采集各平台内容并生成 AI 分析报告</div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-green-600">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            监控运行中 · 下次执行：明天 08:00
          </div>
        </div>
      </section>
    </div>
  );
}
