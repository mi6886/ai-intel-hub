# AI情报中台 — 项目完整交接文档

> 本文件包含项目全部信息。新开 AI 窗口时，让 AI 读取此文件即可获得完整上下文。

---

## 🔑 一句话介绍

一个**小红书 + X/Twitter 双平台 AI 内容监控系统**，每小时自动抓取指定关键词和博主的爆款内容（点赞 > 1000 且最近 2 天发布的），推送到网页通知列表。

---

## 📍 关键访问地址

| 类型 | 地址 |
|------|------|
| **线上网站**（公网） | https://ai-intel-hub.onrender.com |
| **本地开发** | http://localhost:3001 |
| **GitHub 仓库** | https://github.com/mi6886/ai-intel-hub |
| **Render 控制台** | https://dashboard.render.com/web/srv-d7c1k89f9bms73drunlg |
| **cn8n API 文档** | https://s.apifox.cn/4dd9eeb2-ca15-4927-93aa-ae021487a25f（密码: yWBO3kr3）|

---

## 📂 本地文件位置

### 主项目
```
/Users/elainewang/Downloads/content-monitor/   ← AI情报中台（Next.js 项目）
```

### 相关项目
```
/Users/elainewang/Downloads/twitter-monitor/   ← X AI热点情报（Python 爬虫 + 静态 HTML）
```

### 数据文件
```
/Users/elainewang/Documents/Playground/video_account_names_rechecked_209.csv
  ← 209 个小红书博主昵称列表
```

---

## 🏗️ 技术栈

- **前端/后端**：Next.js 16.2.2 + React 19 + TypeScript
- **样式**：Tailwind CSS 4
- **数据库**：SQLite（better-sqlite3，本地文件 + Render 持久化磁盘）
- **部署**：Render 免费计划（Oregon 区域）
- **定时任务**：GitHub Actions（每小时 :17 分触发）
- **数据源**：cn8n.com 第三方 API（付费）

---

## 📁 核心代码文件清单

### 应用层
```
app/
├── layout.tsx                  # 根布局
├── page.tsx                    # 主页面（情报中台 UI + 日历 + 搜索 + 列表）
├── globals.css                 # 全局样式
└── api/
    ├── monitor/route.ts        # 监控规则 CRUD + 触发执行
    ├── alerts/route.ts         # 告警查询 + 标记已读
    ├── contents/route.ts       # 内容查询
    ├── fetch/route.ts          # 手动触发单关键词采集
    ├── history/route.ts        # 搜索历史记录
    ├── keywords/route.ts       # 关键词 CRUD
    └── twitter/route.ts        # Twitter/X 数据读取
```

### 业务逻辑层
```
lib/
├── db.ts                       # SQLite 数据库层（表结构 + 所有 CRUD）
└── xhs.ts                      # cn8n 小红书 API 客户端（含重试逻辑）
```

### 前端组件（部分已弃用）
```
components/
├── NotificationBell.tsx        # 通知铃铛（旧版，已整合到 page.tsx）
├── HistoryTab.tsx              # 搜索历史 Tab（旧版）
├── SettingsTab.tsx             # 监控设置 Tab（旧版）
├── ContentTab.tsx              # 内容 Tab（旧版）
├── ReportTab.tsx               # 选题报告 Tab（旧版）
├── CategoryTabs.tsx            # 分类标签（旧版）
├── DateScroller.tsx            # 日期滚动器（旧版）
└── PlatformFilter.tsx          # 平台筛选（旧版）
```
> ⚠️ 当前主页面 `app/page.tsx` 已大幅简化，不再使用这些组件。但代码仍保留，后续可能复用。

### 数据与配置
```
data/
├── mockData.ts                 # 类型定义 + 初始假数据（仍被引用）
├── monitor.db                  # 本地运行时数据库（gitignore）
└── seed.db                     # 种子数据库（部署到 Render 的初始数据）

public/
├── twitter.html                # 嵌入的 X AI热点情报页面（iframe）
└── twitter-data/               # Twitter JSON 数据文件（66+个）
    ├── final-YYYY-MM-DD-morning.json
    ├── final-YYYY-MM-DD-evening.json
    └── review-*.json

.github/workflows/
└── monitor-cron.yml            # GitHub Actions 每小时触发定时任务

run-monitor.sh                  # 本地 crontab 脚本（备用）
.env.local                      # 环境变量（gitignore）
```

---

## 🗄️ 数据库表结构

### `contents` - 采集的笔记内容
- 通过 cn8n 小红书 API 抓取的原始数据
- 字段：id, category_id, keyword_id, keyword_text, title, platform, author, published_at, likes, comments, shares, collected, url, summary, cover_image, note_type, raw_data, fetched_at

### `monitor_rules` - 监控规则
- 当前有 **256 条规则**（46 个原关键词 + 209 个博主昵称+1）
- 字段：id, category_id, keyword, platform, date_from, date_to, likes_threshold, comments_threshold, interval_minutes, enabled, last_run_at, created_at

### `alerts` - 触发的告警
- 符合规则的笔记（点赞 > 1000 且最近 2 天发布）
- UNIQUE(rule_id, content_id) 防止同一条笔记重复告警
- 字段：id, rule_id, content_id, title, author, platform, likes, comments, collected, url, published_at, triggered_at, is_read

### `fetch_history` - 采集历史
- 记录每次 API 调用
- 字段：id, category_id, platform, keyword, result_count, fetched_at

---

## 🔐 API 密钥与凭证

| 服务 | Key | 用途 |
|------|-----|------|
| **cn8n.com**（当前使用） | `4P2k5Ji978gIvsrcO4sXtEPo2z6Mwnfy` | 小红书数据采集 |
| **极致了（dajiala.com）** | `JZL50ab6cb6bdd2a0f8` | 小红书接口未开通，无法使用 |
| **Render API** | `rnd_sBcHI02Ja2C8pOMZXZXUOf22LCJM` | Render 服务管理（部署用） |
| **TikHub**（已注册，未充值） | - | 备选方案 |

### 环境变量（`.env.local` 本地 / Render 配置）
```
XHS_API_KEY=4P2k5Ji978gIvsrcO4sXtEPo2z6Mwnfy
DB_PATH=/data/monitor.db   (Render 持久化磁盘路径)
```

---

## 🎨 当前 UI 功能

### 顶部导航
- **📡 AI情报中台**（标题，ml:112px）
- **𝕏 AI热点**（ml:135px，嵌入 twitter.html 的 iframe）
- **📕 小红书爆款**（ml:148px，当前主页）
- **搜索框**（ml:175px）

### 主体（小红书爆款 Tab）
- **日历选择器**：自定义组件，有数据的日期黑色，无数据灰色，今天红圈，选中红色实心
- **按时间 / 按点赞** 排序切换
- **告警列表**：每行显示 编号、NEW标签（未读）、标题、作者·关键词·日期、❤️赞⭐藏💬评
- 点击笔记标题跳转小红书 + 标记已读（NEW 消失）

### 监控逻辑
- GitHub Actions 每小时 :17 分触发 `/api/monitor` (action: run)
- 遍历所有 enabled 的规则，每个调 cn8n API（3 页，最多 60 条/关键词）
- 过滤：`published_at >= 2天前` AND `likes >= 1000`
- UNIQUE 约束去重，新达标内容写入 alerts 表

---

## 📊 当前状态（2026-04-10）

- ✅ 部署上线：https://ai-intel-hub.onrender.com
- ✅ 监控规则：256 条
- ✅ 已采集内容：538 条（seed.db）
- ✅ 已触发告警：10 条（4/7-4/8 日期范围）
- ✅ GitHub Actions 定时任务：每小时自动执行
- ✅ 种子数据库已随部署一起推送

### 已知问题
1. **cn8n API 数据滞后**：不同关键词返回的最新数据日期不一致（3-9 天滞后）
2. **精准账号监控未实现**：cn8n 没有"用户笔记列表"接口，209 个博主当前用昵称当关键词兜底
3. **小红书视频数据质量**：部分笔记的字段可能缺失

---

## 🔄 待办事项 / 未来方向

### 短期
- [ ] 尝试部署 MediaCrawler 作为 cn8n 的替代/补充数据源（开源、免费、实时）
- [ ] 添加 Twitter/X 实时数据同步机制（GitHub Actions → Push 到 ai-intel-hub 仓库）

### 中期
- [ ] 如果选 MediaCrawler：需要额外 Python worker 服务
- [ ] 实现真正的"用户精准监控"（获取 userid → 拉取用户笔记列表）

### 长期
- [ ] AI 选题分析功能（接入 OpenAI/Claude API）
- [ ] 多用户支持 / 权限系统

---

## 🛠️ 常用命令

### 本地开发
```bash
cd /Users/elainewang/Downloads/content-monitor
npm run dev -- -p 3001    # 启动开发服务器
npm run build              # 构建
```

### 手动触发监控
```bash
# 线上
curl -X POST 'https://ai-intel-hub.onrender.com/api/monitor' \
  -H 'Content-Type: application/json' \
  -d '{"action":"run"}'

# 本地
curl -X POST 'http://localhost:3001/api/monitor' \
  -H 'Content-Type: application/json' \
  -d '{"action":"run"}'
```

### Git 操作
```bash
cd /Users/elainewang/Downloads/content-monitor
git status
git add -A
git commit -m "xxx"
git push
# Render 会自动部署
```

### 数据库查询
```bash
sqlite3 /Users/elainewang/Downloads/content-monitor/data/monitor.db \
  "SELECT keyword, last_run_at FROM monitor_rules ORDER BY last_run_at DESC LIMIT 10;"
```

---

## 📝 新 AI 窗口上下文提示词

在新窗口开始时，可以用这段话快速给 AI 上下文：

```
我有一个叫「AI情报中台」的项目，代码在 /Users/elainewang/Downloads/content-monitor/。
请先读取 PROJECT_HANDOFF.md 了解项目全貌。

关键点：
- Next.js + SQLite 项目，部署在 https://ai-intel-hub.onrender.com
- 监控小红书爆款笔记和 X/Twitter AI 热点
- 数据源是 cn8n.com API (key 在 .env.local)
- 每小时自动跑一次监控（GitHub Actions）

GitHub: https://github.com/mi6886/ai-intel-hub
```

---

## 📞 外部服务

| 服务 | 地址 | 用途 |
|------|------|------|
| cn8n.com | https://cn8n.com | 小红书 API 供应商（当前使用） |
| Render | https://dashboard.render.com | 部署服务商 |
| GitHub | https://github.com/mi6886 | 代码托管 + Actions 定时任务 |
| TikHub | https://user.tikhub.io | 备选 API 供应商（未充值） |
| MediaCrawler | https://github.com/NanmiCoder/MediaCrawler | 开源爬虫备选方案 |

---

_最后更新：2026-04-10_
