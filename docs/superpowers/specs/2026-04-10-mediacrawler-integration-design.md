# MediaCrawler 接入设计

## 背景

当前 AI 情报中台使用 cn8n.com 付费 API 作为小红书数据源，存在两个核心问题：
1. **数据滞后严重**：不同关键词索引延迟 3-9 天，无法监控最新爆款
2. **缺少用户笔记列表接口**：cn8n 只有搜索接口，无法精准监控指定博主的新笔记

MediaCrawler（GitHub 27.7k star）是开源的社媒爬虫，使用 Playwright 真实浏览器模拟用户访问，**数据实时 + 完全免费 + 支持用户笔记列表**，能根本性解决上述问题。

本设计将 MediaCrawler 接入 AI 情报中台，**完全替代 cn8n**。

## 目标

- ✅ 用 MediaCrawler 替代 cn8n，获得实时小红书数据
- ✅ 既支持现有 46 个关键词监控，也支持 209 个博主的精准监控
- ✅ 前端网页 https://ai-intel-hub.onrender.com 功能和 UI 完全不变
- ✅ 不增加月度成本（cn8n 停用）

## 非目标

- ❌ 不处理小红书风控升级导致的爬虫失效（出问题手动 `git pull` 更新 MediaCrawler）
- ❌ 不实现多平台（只做小红书，X/Twitter 继续沿用当前方案）
- ❌ 不替换现有 cn8n 的历史告警数据，新旧数据并存

## 架构总览

```
┌──────────────────────────────────────────────────────────┐
│  家里 MacBook Air（一直开着）                              │
│                                                          │
│  launchd (macOS 定时任务) —— 每 2 小时触发                │
│         ↓                                                │
│  ~/mediacrawler-runner/runner/run.py                     │
│    ├─ 从 Render 拉取当前监控规则                          │
│    ├─ 启动 MediaCrawler（headless Chromium）             │
│    ├─ 加载 XHS 登录 cookie                               │
│    ├─ 遍历关键词：调 search                              │
│    ├─ 遍历博主昵称：先查 userid，再调 user_posts         │
│    ├─ 合并去重                                           │
│    └─ POST 到 Render /api/ingest                         │
│         ↓                                                │
│  POST https://ai-intel-hub.onrender.com/api/ingest       │
│      Header: Authorization: Bearer <INGEST_TOKEN>        │
│      Body: {source, items:[{platform, id, title, ...}]} │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│  Render：ai-intel-hub.onrender.com                       │
│                                                          │
│  NEW: /api/ingest                                        │
│    ├─ 验证 INGEST_TOKEN                                  │
│    ├─ 写 contents 表（INSERT OR REPLACE 去重）           │
│    ├─ 对每条内容匹配 monitor_rules                       │
│    ├─ 符合 (likes≥1000 且最近2天) → 写 alerts            │
│    └─ 返回 {inserted, new_alerts}                        │
│                                                          │
│  前端 app/page.tsx 不动                                   │
│  其他 API 路由不动                                        │
└──────────────────────────────────────────────────────────┘
```

**职责划分：**
- **家里 Mac**：只负责"爬"——浏览器、登录、采集、上传
- **Render**：负责"存 + 展示"——接收数据、过滤、去重、写 SQLite、前端展示

## 数据流

### 单次执行流程

1. launchd 触发 `run.py`
2. `run.py` 调 Render `GET /api/monitor?categoryId=cat-1` 拉取启用的规则列表
3. 把规则分成两类：
   - 普通关键词（46 个）→ 调 `search` 方法
   - 博主昵称（209 个）→ 先 `search_users` 查 userid，再 `get_user_posts(userid)`
4. MediaCrawler 启动 headless Chromium，加载 cookie
5. 串行遍历所有监控项（避免并发触发风控），每条大约耗时 3-5 秒
6. 收集所有笔记结果，合并去重（按 note_id）
7. POST 到 `/api/ingest`，携带批量 JSON
8. 服务端处理成功后，本地写日志并退出
9. 失败时把 payload 存到 `logs/failed/YYYYMMDD-HHMM.json`，下次运行前重试

### `POST /api/ingest` 请求格式

```json
{
  "source": "mediacrawler",
  "items": [
    {
      "platform": "xiaohongshu",
      "note_id": "65a...",
      "title": "...",
      "desc": "...",
      "author_name": "...",
      "author_id": "...",
      "url": "...",
      "cover_image": "...",
      "published_at": "2026-04-09T10:30:00+08:00",
      "likes": 1234,
      "comments": 56,
      "collected": 78,
      "shares": 12,
      "matched_rule": {
        "type": "keyword",
        "value": "vibecoding"
      }
    }
  ]
}
```

`matched_rule` 字段告诉服务端这条数据是哪条规则采集来的，方便写 contents 表时填充 `keyword_text` 和关联 rule_id。

### 响应格式

```json
{
  "success": true,
  "inserted": 245,
  "updated": 12,
  "new_alerts": 7,
  "errors": []
}
```

## 核心组件设计

### 家里 Mac：`~/mediacrawler-runner/`

```
mediacrawler-runner/
├── MediaCrawler/              # git clone https://github.com/NanmiCoder/MediaCrawler
├── config/
│   ├── rules.cache.json       # 本地规则缓存（容灾用，Render 不可达时回退）
│   ├── cookie.json            # XHS 登录 cookie
│   └── .env                   # INGEST_TOKEN, RENDER_URL
├── runner/
│   ├── run.py                 # 主入口
│   ├── fetcher.py             # MediaCrawler 调用封装
│   ├── mapper.py              # MediaCrawler 返回 → 统一 ingest 格式
│   ├── uploader.py            # POST /api/ingest + 重试
│   └── logger.py              # 日志
├── logs/
│   ├── run-YYYYMMDD-HHMM.log  # 每次执行的详细日志
│   └── failed/                # 上传失败的 payload
└── com.ai-intel-hub.crawler.plist  # launchd 配置
```

**run.py 伪代码：**

```python
def main():
    # 1. 拉规则（网络失败时用 rules.cache.json 回退）
    rules = fetch_rules_or_cache()

    # 2. 初始化 MediaCrawler
    crawler = XhsCrawler(cookie_path='config/cookie.json', headless=True)

    # 3. 遍历关键词
    items = []
    for rule in rules:
        try:
            if rule['type'] == 'keyword':
                result = crawler.search_notes(rule['keyword'], limit=20)
            elif rule['type'] == 'account':
                uid = crawler.search_user_by_name(rule['keyword'])
                if uid:
                    result = crawler.get_user_posts(uid, limit=20)
                else:
                    continue
            items.extend(map_to_ingest_format(result, rule))
        except Exception as e:
            log.error(f"Failed rule {rule}: {e}")
            continue

    # 4. 去重
    items = dedupe_by_note_id(items)

    # 5. 上传
    upload_to_render(items)

    # 6. 清理浏览器
    crawler.close()
```

### Render 端：`app/api/ingest/route.ts`

- **认证**：校验 `Authorization: Bearer ${process.env.INGEST_TOKEN}`
- **写入 contents 表**：用 `INSERT OR REPLACE`，以 `id` 为主键，同一笔记重复上传会覆盖更新（点赞数会刷新）
- **匹配监控规则**：对每条新内容，查 `monitor_rules` 表，如果 `matched_rule.value` 能对上某条规则，就走该规则的阈值和日期判断
- **写 alerts**：符合条件的写入 alerts 表，`INSERT OR IGNORE` + `UNIQUE(rule_id, content_id)` 自动去重
- **日志**：记录本次 ingest 的 rule_id、新增数、告警数到 `fetch_history` 表

### launchd 定时任务配置

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ai-intel-hub.crawler</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/Users/xxx/mediacrawler-runner/runner/run.py</string>
    </array>
    <key>StartInterval</key>
    <integer>7200</integer>  <!-- 2 hours -->
    <key>RunAtLoad</key>
    <false/>
    <key>StandardOutPath</key>
    <string>/Users/xxx/mediacrawler-runner/logs/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/xxx/mediacrawler-runner/logs/stderr.log</string>
</dict>
</plist>
```

安装：`launchctl load ~/Library/LaunchAgents/com.ai-intel-hub.crawler.plist`

## 接口契约

### `POST /api/ingest`

**Request**
```
Authorization: Bearer {INGEST_TOKEN}
Content-Type: application/json

{
  "source": "mediacrawler",
  "category_id": "cat-1",
  "items": [
    {
      "platform": "xiaohongshu",
      "note_id": "string",
      "title": "string",
      "desc": "string",
      "author_name": "string",
      "author_id": "string",
      "url": "string",
      "cover_image": "string",
      "published_at": "ISO 8601 string",
      "likes": 0,
      "comments": 0,
      "collected": 0,
      "shares": 0,
      "matched_rule": {
        "type": "keyword" | "account",
        "value": "string"
      }
    }
  ]
}
```

**Response**
```json
{
  "success": true,
  "inserted": 0,
  "updated": 0,
  "new_alerts": 0
}
```

**错误响应**
- 401: token 错误
- 400: JSON 格式错误 / items 为空
- 500: 服务端处理失败

## 环境变量

### Render 新增
- `INGEST_TOKEN`：32 字符随机字符串，用 `openssl rand -hex 16` 生成

### 家里 Mac 新增 (config/.env)
- `INGEST_TOKEN`：与 Render 相同
- `RENDER_URL`：`https://ai-intel-hub.onrender.com`

### 已有变量保留不动
- Render: `XHS_API_KEY`（cn8n 的，暂时保留以防回退）、`DB_PATH`
- Render: 其他无改动

## 错误处理

### 家里 Mac 侧
- **规则拉取失败** → 用 `rules.cache.json` 回退，跳过此次更新规则
- **MediaCrawler 单条失败** → 记录到日志，继续下一条
- **MediaCrawler 整体失败**（浏览器崩溃）→ 保存错误日志，退出（下次 2 小时后重试）
- **上传 Render 失败** → 把 payload 写到 `logs/failed/YYYYMMDD-HHMM.json`，下次运行开始时先重试所有 failed payload
- **Cookie 过期** → 日志显示"cookie expired, please re-login"，邮件或 Telegram 通知（v2 再加）

### Render 侧
- **Token 错误** → 401
- **JSON 无效** → 400
- **单条 item 处理失败** → 加入 errors 数组，继续处理其他 item，响应里返回
- **DB 写入失败** → 500，返回 error message

## 数据库变更

### 零 schema 变更

- `contents` 表：已有字段完全覆盖 MediaCrawler 的数据
- `monitor_rules` 表：沿用现有 256 条规则，但**需要增加一个逻辑概念**：规则类型（keyword vs account）
- `alerts` 表：沿用

**关于规则类型：**
- 现有 `monitor_rules` 表没有 `rule_type` 字段
- 最简方案：不加字段，继续让 256 条规则都按"关键词"语义，MediaCrawler 对每条都尝试"既搜关键词、也搜用户"
- 更好方案（推荐）：后续加一个 `rule_type` TEXT 字段（默认 `keyword`），给 209 个博主那些规则改成 `account`

**本次只做最简方案**，MediaCrawler 在 Mac 端自己维护一个映射（昵称来自 CSV 的 209 个标记为 account，其他 46 个标记为 keyword），避免动 schema。

## 测试计划

### 阶段 1：小范围手工验证
1. 在家里 Mac 上装好 MediaCrawler 和依赖
2. 手动跑一次 `run.py`，只启用 5 个规则，目标：能打印出采集结果
3. 手动 POST 一次到 Render `/api/ingest`，验证 Render 端能收到并写入

### 阶段 2：本地全量一次
1. 启用全部 256 条规则，手动跑一次 `run.py`
2. 观察：
   - 总耗时（预期 30-45 分钟）
   - 内存峰值（预期 1.5-2GB）
   - 成功率（预期 > 90%）
   - 触发的新告警数（预期至少 10 条以上，因为现在 cn8n 有滞后）

### 阶段 3：定时运行
1. 安装 launchd，每 2 小时跑一次
2. 连续观察 24 小时
3. 确认日志正常、告警正常、cookie 没过期

### 阶段 4：停用 cn8n
1. 观察 MediaCrawler 连续 3 天稳定工作后
2. 禁用 GitHub Actions 里 cn8n 的 cron 触发
3. 保留 cn8n 的 API Key 几周（防止回退）

## 部署步骤（顺序）

### A. Render 端（先做，因为 MediaCrawler 需要调用）
1. 代码：新增 `app/api/ingest/route.ts`
2. 环境变量：在 Render dashboard 加 `INGEST_TOKEN`
3. 推送代码 → Render 自动部署
4. 用 curl 测试：`POST /api/ingest` 返回 200

### B. 家里 Mac 端
1. `git clone https://github.com/NanmiCoder/MediaCrawler ~/mediacrawler-runner/MediaCrawler`
2. 按 MediaCrawler README 装依赖 + Playwright browsers
3. 创建 `config/.env`，填入 INGEST_TOKEN 和 RENDER_URL
4. 写 `runner/run.py` 等脚本
5. 手动跑一次 headed 模式登录小红书，保存 cookie
6. 手动跑一次 headless 模式小范围测试
7. 全量测试
8. 装 launchd 定时任务

## 成本估算

| 项 | 成本 |
|---|---|
| MediaCrawler 本身 | $0 |
| 家里 Mac 电费（额外） | 几乎可忽略（每 2 小时跑 10 分钟） |
| Render 继续免费版 | $0 |
| cn8n 节约 | -${已充值的金额，停用后不再扣费} |
| **总计** | **$0/月** |

## 风险与应对

| 风险 | 概率 | 影响 | 应对 |
|---|---|---|---|
| 小红书风控升级，MediaCrawler 失效 | 中 | 高 | 社区修复后 `git pull`，或临时回退 cn8n |
| Cookie 过期 | 高 | 中 | 日志监控 + 手动重新登录 |
| MacBook Air 内存不够 | 低 | 中 | 降低监控规则数或频率 |
| Mac 关机 | 中 | 高 | launchd 的 StartInterval 会在开机后继续 |
| Render 免费版休眠 | 中 | 低 | `/api/ingest` 请求会唤醒服务（冷启动 30s） |

## 开放问题（v2 再考虑）

- Cookie 过期自动通知（Telegram/邮件）
- 采集失败率监控面板
- 多机容灾（家里 Mac 挂了自动切到备用机）
- 支持抖音、B站、微博等其他平台（MediaCrawler 都支持）
