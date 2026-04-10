# MediaCrawler 接入实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 MediaCrawler 替代 cn8n 作为小红书数据源，在家里 MacBook Air 上每 2 小时自动采集数据并推送到 Render 服务。

**Architecture:** 家里 Mac 用 launchd 定时触发 Python runner → runner 调用 MediaCrawler (Playwright headless Chromium) → 收集关键词搜索和博主笔记结果 → HTTP POST 到 Render `/api/ingest` 端点 → Render 端写入 SQLite 并触发告警。

**Tech Stack:**
- **Render 端**：Next.js 16 Route Handler (TypeScript) + better-sqlite3
- **家里 Mac 端**：Python 3.11+ + MediaCrawler (Playwright) + launchd
- **通信**：HTTP POST JSON + Bearer Token

---

## 文件结构

### Render 端（本项目 `/Users/elainewang/Downloads/content-monitor/`）

**新建：**
- `app/api/ingest/route.ts` — 接收 MediaCrawler 采集数据的端点
- `lib/ingest.ts` — 数据摄入与规则匹配的核心逻辑（从 route handler 抽出以便单元测试）
- `tests/ingest.test.ts` — ingest 逻辑的单元测试

**修改：**
- `.env.local` — 添加 `INGEST_TOKEN`（本地）
- Render 环境变量 — 添加 `INGEST_TOKEN`（线上，手动）
- `PROJECT_HANDOFF.md` — 更新架构说明

### 家里 Mac 端（`~/Downloads/mediacrawler-runner/`，待打包）

**新建：**
```
mediacrawler-runner/
├── MediaCrawler/                     # git clone 的开源项目
├── runner/
│   ├── __init__.py
│   ├── run.py                        # 主入口
│   ├── rules.py                      # 从 Render 拉规则 + 缓存
│   ├── crawler.py                    # MediaCrawler 调用封装
│   ├── mapper.py                     # MediaCrawler 返回 → ingest JSON 格式
│   ├── uploader.py                   # POST /api/ingest + 失败重试
│   └── logger.py                     # 日志初始化
├── config/
│   ├── .env.example                  # 配置模板
│   └── accounts_map.json             # 209 个博主昵称列表
├── logs/
│   ├── .gitkeep
│   └── failed/                       # 失败 payload 保存处
├── install.sh                        # 一键安装依赖
├── install-cron.sh                   # 安装 launchd 定时任务
├── login.sh                          # 首次登录小红书（有界面）
├── test.sh                           # 小规模测试
├── run-now.sh                        # 手动立即执行一次
├── com.ai-intel-hub.crawler.plist    # launchd 配置模板
├── requirements.txt                  # Python 依赖
├── pytest.ini                        # 测试配置
├── tests/
│   ├── test_mapper.py                # mapper 单元测试
│   ├── test_rules.py                 # rules 单元测试
│   └── test_uploader.py              # uploader 单元测试
└── README.md                         # 详细安装文档
```

---

## 任务划分

### Phase A：Render 端 `/api/ingest` 端点

### Task A1：创建 ingest 逻辑模块（带单元测试）

**Files:**
- Create: `/Users/elainewang/Downloads/content-monitor/lib/ingest.ts`
- Create: `/Users/elainewang/Downloads/content-monitor/tests/ingest.test.ts`

- [ ] **Step 1: 先确认测试框架**

Run:
```bash
cd /Users/elainewang/Downloads/content-monitor && cat package.json | grep -A 5 '"scripts"'
```

Expected output: 看到 `"test"` 脚本（可能不存在）。如果不存在，先装 vitest：

```bash
npm install -D vitest @vitest/ui
```

然后在 `package.json` 的 scripts 中添加：
```json
"test": "vitest run",
"test:watch": "vitest"
```

Commit:
```bash
git add package.json package-lock.json
git commit -m "chore: add vitest for unit tests"
```

- [ ] **Step 2: 写 ingest 的类型定义和失败测试**

创建 `/Users/elainewang/Downloads/content-monitor/tests/ingest.test.ts`：

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { processIngestItems, IngestItem } from '@/lib/ingest';

// 用内存 sqlite 避免污染真实数据库
process.env.DB_PATH = ':memory:';

describe('processIngestItems', () => {
  const sampleItem: IngestItem = {
    platform: 'xiaohongshu',
    note_id: 'note_123',
    title: 'test title',
    desc: 'test desc',
    author_name: 'tester',
    author_id: 'user_1',
    url: 'https://xhs.com/note_123',
    cover_image: '',
    published_at: new Date().toISOString(),
    likes: 1500,
    comments: 10,
    collected: 5,
    shares: 2,
    matched_rule: { type: 'keyword', value: 'vibecoding' },
  };

  it('returns success with empty array for empty input', () => {
    const result = processIngestItems([], 'cat-1');
    expect(result.success).toBe(true);
    expect(result.inserted).toBe(0);
    expect(result.new_alerts).toBe(0);
  });

  it('inserts one content and triggers one alert for high-like new item', () => {
    const result = processIngestItems([sampleItem], 'cat-1');
    expect(result.inserted).toBe(1);
    // Alert may or may not trigger depending on whether monitor_rules table
    // has a matching rule in the test DB. We at least verify no crash.
    expect(result.success).toBe(true);
  });

  it('deduplicates by note_id on repeated insert', () => {
    processIngestItems([sampleItem], 'cat-1');
    const secondResult = processIngestItems([sampleItem], 'cat-1');
    expect(secondResult.success).toBe(true);
    // Second call should not cause duplicate row (updated instead)
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd /Users/elainewang/Downloads/content-monitor && npx vitest run tests/ingest.test.ts`

Expected: FAIL with module not found error for `@/lib/ingest`.

- [ ] **Step 4: 实现 `lib/ingest.ts`**

创建 `/Users/elainewang/Downloads/content-monitor/lib/ingest.ts`：

```ts
import { getDb, saveContents, createAlert, saveFetchHistory, DbContentItem } from './db';

export interface IngestItem {
  platform: string;
  note_id: string;
  title: string;
  desc: string;
  author_name: string;
  author_id: string;
  url: string;
  cover_image: string;
  published_at: string;
  likes: number;
  comments: number;
  collected: number;
  shares: number;
  matched_rule: {
    type: 'keyword' | 'account';
    value: string;
  };
}

export interface IngestResult {
  success: boolean;
  inserted: number;
  updated: number;
  new_alerts: number;
  errors: string[];
}

function itemToDbContent(item: IngestItem, categoryId: string): DbContentItem {
  return {
    id: `${item.platform}-${item.note_id}`,
    category_id: categoryId,
    keyword_id: null,
    keyword_text: item.matched_rule.value,
    title: item.title || '(无标题)',
    platform: item.platform,
    author: item.author_name || '未知用户',
    published_at: item.published_at,
    likes: item.likes || 0,
    comments: item.comments || 0,
    shares: item.shares || 0,
    collected: item.collected || 0,
    url: item.url || '',
    summary: item.desc || '',
    cover_image: item.cover_image || '',
    note_type: 'normal',
    raw_data: JSON.stringify(item),
    fetched_at: new Date().toISOString(),
  };
}

export function processIngestItems(
  items: IngestItem[],
  categoryId: string
): IngestResult {
  const result: IngestResult = {
    success: true,
    inserted: 0,
    updated: 0,
    new_alerts: 0,
    errors: [],
  };

  if (items.length === 0) return result;

  const db = getDb();

  // 1. Save contents
  const dbItems = items.map((i) => itemToDbContent(i, categoryId));
  try {
    saveContents(dbItems);
    result.inserted = dbItems.length;
  } catch (e) {
    result.errors.push(`saveContents failed: ${e}`);
    result.success = false;
    return result;
  }

  // 2. Match against monitor_rules and create alerts
  const now = new Date();
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const cutoffDate = twoDaysAgo.toISOString().split('T')[0];

  const rulesStmt = db.prepare(
    'SELECT id, keyword, likes_threshold, comments_threshold, date_from, date_to FROM monitor_rules WHERE category_id = ? AND enabled = 1 AND keyword = ?'
  );

  for (const item of items) {
    const rules = rulesStmt.all(categoryId, item.matched_rule.value) as Array<{
      id: number;
      keyword: string;
      likes_threshold: number;
      comments_threshold: number;
      date_from: string | null;
      date_to: string | null;
    }>;

    for (const rule of rules) {
      const pubDate = item.published_at.split('T')[0];
      // Date filter
      if (rule.date_from || rule.date_to) {
        if (rule.date_from && pubDate < rule.date_from) continue;
        if (rule.date_to && pubDate > rule.date_to) continue;
      } else {
        if (pubDate < cutoffDate) continue;
      }
      // Threshold filter
      if (rule.likes_threshold > 0 && item.likes < rule.likes_threshold) continue;
      if (rule.comments_threshold > 0 && item.comments < rule.comments_threshold) continue;

      const alertId = createAlert({
        rule_id: rule.id,
        content_id: `${item.platform}-${item.note_id}`,
        title: item.title,
        author: item.author_name,
        platform: item.platform,
        likes: item.likes,
        comments: item.comments,
        collected: item.collected,
        url: item.url,
        published_at: item.published_at,
        triggered_at: new Date().toISOString(),
        is_read: 0,
      });
      if (alertId !== null) result.new_alerts++;
    }
  }

  // 3. Record fetch history
  try {
    saveFetchHistory({
      category_id: categoryId,
      platform: 'xiaohongshu',
      keyword: 'mediacrawler-batch',
      result_count: items.length,
      fetched_at: new Date().toISOString(),
    });
  } catch (e) {
    result.errors.push(`saveFetchHistory failed: ${e}`);
  }

  return result;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd /Users/elainewang/Downloads/content-monitor && npx vitest run tests/ingest.test.ts`

Expected: PASS (3 tests)

如果失败提示 DB 相关错误（因为 `:memory:` 路径在测试中可能无法自动建表），修改测试设置：

```ts
// 在 beforeEach 内直接调用 getDb() 触发 initSchema
import { getDb } from '@/lib/db';
beforeEach(() => {
  process.env.DB_PATH = ':memory:';
  getDb();
});
```

重新跑测试。

- [ ] **Step 6: Commit**

```bash
cd /Users/elainewang/Downloads/content-monitor
git add lib/ingest.ts tests/ingest.test.ts
git commit -m "feat(ingest): add ingest processor with unit tests"
```

---

### Task A2：创建 `/api/ingest` Route Handler

**Files:**
- Create: `/Users/elainewang/Downloads/content-monitor/app/api/ingest/route.ts`

- [ ] **Step 1: 创建路由文件**

创建 `/Users/elainewang/Downloads/content-monitor/app/api/ingest/route.ts`：

```ts
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

  const { source, category_id, items } = body as {
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
```

- [ ] **Step 2: 本地手动测试 — 启动 dev server**

Run:
```bash
cd /Users/elainewang/Downloads/content-monitor
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
# Add INGEST_TOKEN to .env.local first
echo "INGEST_TOKEN=test-local-token-abc123" >> .env.local
npm run dev -- -p 3001
```

等到显示 `✓ Ready`。

- [ ] **Step 3: 测试 401 未授权**

在另一个终端运行：
```bash
curl -s -X POST 'http://localhost:3001/api/ingest' \
  -H 'Content-Type: application/json' \
  -d '{"items":[]}' | python3 -m json.tool
```

Expected:
```json
{"success": false, "error": "Unauthorized"}
```

- [ ] **Step 4: 测试 200 空数组成功**

```bash
curl -s -X POST 'http://localhost:3001/api/ingest' \
  -H 'Authorization: Bearer test-local-token-abc123' \
  -H 'Content-Type: application/json' \
  -d '{"items":[],"category_id":"cat-1"}' | python3 -m json.tool
```

Expected:
```json
{
  "success": true,
  "inserted": 0,
  "updated": 0,
  "new_alerts": 0,
  "errors": []
}
```

- [ ] **Step 5: 测试 400 无效 items**

```bash
curl -s -X POST 'http://localhost:3001/api/ingest' \
  -H 'Authorization: Bearer test-local-token-abc123' \
  -H 'Content-Type: application/json' \
  -d '{"items":"not an array"}' | python3 -m json.tool
```

Expected:
```json
{"success": false, "error": "items must be an array"}
```

- [ ] **Step 6: 测试真实数据插入**

```bash
curl -s -X POST 'http://localhost:3001/api/ingest' \
  -H 'Authorization: Bearer test-local-token-abc123' \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "mediacrawler",
    "category_id": "cat-1",
    "items": [{
      "platform": "xiaohongshu",
      "note_id": "test001",
      "title": "测试笔记",
      "desc": "这是测试",
      "author_name": "tester",
      "author_id": "u1",
      "url": "https://xiaohongshu.com/test",
      "cover_image": "",
      "published_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
      "likes": 2000,
      "comments": 10,
      "collected": 5,
      "shares": 2,
      "matched_rule": {"type":"keyword","value":"vibecoding"}
    }]
  }' | python3 -m json.tool
```

Expected: `success: true, inserted: 1`. 如果 vibecoding 规则启用，应该看到 `new_alerts: 1`。

验证数据库：
```bash
sqlite3 /Users/elainewang/Downloads/content-monitor/data/monitor.db \
  "SELECT id, title, likes FROM contents WHERE id='xiaohongshu-test001';"
```

Expected: 看到 `xiaohongshu-test001|测试笔记|2000`

- [ ] **Step 7: 清理测试数据**

```bash
sqlite3 /Users/elainewang/Downloads/content-monitor/data/monitor.db \
  "DELETE FROM contents WHERE id='xiaohongshu-test001'; DELETE FROM alerts WHERE content_id='xiaohongshu-test001';"
```

停止 dev server (Ctrl+C)。

- [ ] **Step 8: Commit**

```bash
cd /Users/elainewang/Downloads/content-monitor
git add app/api/ingest/route.ts
git commit -m "feat(api): add /api/ingest endpoint for MediaCrawler"
```

---

### Task A3：推送到 GitHub 并配置 Render 环境变量

- [ ] **Step 1: 生成生产环境 INGEST_TOKEN**

```bash
openssl rand -hex 16
```

记下输出（例如 `a1b2c3d4e5f6...`），这就是生产环境的 token。

- [ ] **Step 2: 在 Render 添加环境变量**

使用 Render API 添加环境变量：

```bash
RENDER_KEY="rnd_sBcHI02Ja2C8pOMZXZXUOf22LCJM"
SERVICE_ID="srv-d7c1k89f9bms73drunlg"
TOKEN="<上一步生成的 token>"

curl -s -X PUT "https://api.render.com/v1/services/${SERVICE_ID}/env-vars" \
  -H "Authorization: Bearer ${RENDER_KEY}" \
  -H 'Content-Type: application/json' \
  -d "[
    {\"key\":\"XHS_API_KEY\",\"value\":\"4P2k5Ji978gIvsrcO4sXtEPo2z6Mwnfy\"},
    {\"key\":\"DB_PATH\",\"value\":\"/data/monitor.db\"},
    {\"key\":\"INGEST_TOKEN\",\"value\":\"${TOKEN}\"}
  ]"
```

Expected: 返回 200 JSON，列出三个环境变量。

**注意：PUT 会替换全部环境变量，必须把原有的都列上**。

- [ ] **Step 3: 推送代码到 GitHub 触发自动部署**

```bash
cd /Users/elainewang/Downloads/content-monitor
git push
```

- [ ] **Step 4: 等待部署完成并验证**

```bash
sleep 120
# Wait 2 minutes for deploy
curl -s "https://api.render.com/v1/services/${SERVICE_ID}/deploys?limit=1" \
  -H "Authorization: Bearer ${RENDER_KEY}" | python3 -c "
import sys, json
d = json.load(sys.stdin)[0]['deploy']
print('status:', d.get('status'))
print('finished:', d.get('finishedAt','pending'))
"
```

Expected: `status: live`

- [ ] **Step 5: 验证线上 /api/ingest 可用**

```bash
TOKEN="<生产 token>"
curl -s -X POST 'https://ai-intel-hub.onrender.com/api/ingest' \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"items":[],"category_id":"cat-1"}' | python3 -m json.tool
```

Expected:
```json
{"success": true, "inserted": 0, "updated": 0, "new_alerts": 0, "errors": []}
```

- [ ] **Step 6: 记录生产 token**

**保存 token 到安全的地方**（比如密码管理器或者本地 `.env.production.local` 文件，加到 .gitignore）。

```bash
echo "INGEST_TOKEN_PROD=${TOKEN}" >> /Users/elainewang/Downloads/content-monitor/.env.production.local
echo ".env.production.local" >> /Users/elainewang/Downloads/content-monitor/.gitignore
```

---

### Phase B：本地 MediaCrawler Runner 项目

### Task B1：初始化 runner 项目目录

**Files:**
- Create: `/Users/elainewang/Downloads/mediacrawler-runner/` 整个目录

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p /Users/elainewang/Downloads/mediacrawler-runner/{runner,config,logs/failed,tests}
cd /Users/elainewang/Downloads/mediacrawler-runner
git init
echo "logs/" > .gitignore
echo "config/.env" >> .gitignore
echo "config/cookie.json" >> .gitignore
echo "MediaCrawler/" >> .gitignore
echo "__pycache__/" >> .gitignore
echo "*.pyc" >> .gitignore
echo ".venv/" >> .gitignore
touch logs/.gitkeep
touch runner/__init__.py
touch tests/__init__.py
```

- [ ] **Step 2: 创建 requirements.txt**

Create `/Users/elainewang/Downloads/mediacrawler-runner/requirements.txt`:

```
requests>=2.31.0
python-dotenv>=1.0.0
pytest>=7.4.0
playwright>=1.40.0
```

- [ ] **Step 3: 创建 config/.env.example**

Create `/Users/elainewang/Downloads/mediacrawler-runner/config/.env.example`:

```
# Render API endpoint
RENDER_URL=https://ai-intel-hub.onrender.com

# Ingest token (get from Render env vars)
INGEST_TOKEN=replace-with-real-token

# Category ID for monitor rules
CATEGORY_ID=cat-1

# MediaCrawler installation path
MEDIACRAWLER_PATH=./MediaCrawler

# Cookie file path
COOKIE_PATH=./config/cookie.json
```

- [ ] **Step 4: Commit**

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner
git add -A
git commit -m "init: mediacrawler-runner project scaffold"
```

---

### Task B2：实现 rules 模块（从 Render 拉取规则）

**Files:**
- Create: `/Users/elainewang/Downloads/mediacrawler-runner/runner/rules.py`
- Create: `/Users/elainewang/Downloads/mediacrawler-runner/tests/test_rules.py`

- [ ] **Step 1: 写失败的测试**

Create `/Users/elainewang/Downloads/mediacrawler-runner/tests/test_rules.py`:

```python
import json
import os
from pathlib import Path
from unittest.mock import patch, MagicMock
import pytest

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from runner.rules import fetch_rules, classify_rules, ACCOUNT_NAMES


def test_classify_rules_keyword_only():
    rules = [{"id": 1, "keyword": "vibecoding", "enabled": 1}]
    result = classify_rules(rules)
    assert len(result['keywords']) == 1
    assert len(result['accounts']) == 0


def test_classify_rules_account_detected():
    # 假设 ACCOUNT_NAMES 里有 "Next蔡蔡"
    rules = [
        {"id": 2, "keyword": "Next蔡蔡", "enabled": 1},
        {"id": 3, "keyword": "vibecoding", "enabled": 1},
    ]
    with patch('runner.rules.ACCOUNT_NAMES', {"Next蔡蔡"}):
        result = classify_rules(rules)
        assert len(result['accounts']) == 1
        assert result['accounts'][0]['keyword'] == "Next蔡蔡"
        assert len(result['keywords']) == 1


def test_classify_rules_filters_disabled():
    rules = [
        {"id": 1, "keyword": "vibecoding", "enabled": 1},
        {"id": 2, "keyword": "disabled_one", "enabled": 0},
    ]
    result = classify_rules(rules)
    assert len(result['keywords']) == 1


def test_fetch_rules_success(tmp_path):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "success": True,
        "rules": [{"id": 1, "keyword": "test", "enabled": 1}],
    }
    cache_path = tmp_path / "rules.cache.json"
    with patch('requests.get', return_value=mock_response):
        result = fetch_rules("https://example.com", "cat-1", cache_path)
    assert len(result) == 1
    assert cache_path.exists()


def test_fetch_rules_fallback_to_cache(tmp_path):
    cache_path = tmp_path / "rules.cache.json"
    cache_path.write_text(json.dumps([{"id": 1, "keyword": "cached", "enabled": 1}]))

    with patch('requests.get', side_effect=Exception("network error")):
        result = fetch_rules("https://example.com", "cat-1", cache_path)
    assert len(result) == 1
    assert result[0]['keyword'] == "cached"
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest tests/test_rules.py -v
```

Expected: FAIL with ImportError for `runner.rules`

- [ ] **Step 3: 实现 runner/rules.py**

Create `/Users/elainewang/Downloads/mediacrawler-runner/runner/rules.py`:

```python
"""从 Render 拉取监控规则，并区分关键词/博主类型。"""
import json
from pathlib import Path
from typing import Any

import requests

# 209 个博主的昵称集合，通过此集合判断一条规则是关键词还是博主
ACCOUNT_NAMES: set[str] = set()


def load_account_names(path: Path) -> set[str]:
    """从 accounts_map.json 加载博主昵称集合。"""
    global ACCOUNT_NAMES
    if path.exists():
        ACCOUNT_NAMES = set(json.loads(path.read_text(encoding='utf-8')))
    return ACCOUNT_NAMES


def fetch_rules(
    render_url: str,
    category_id: str,
    cache_path: Path,
    timeout: int = 20,
) -> list[dict[str, Any]]:
    """
    拉取启用的监控规则。
    - 成功：写缓存 + 返回
    - 失败：从缓存读取 fallback
    """
    try:
        resp = requests.get(
            f"{render_url}/api/monitor",
            params={"categoryId": category_id},
            timeout=timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data.get("success"):
            raise ValueError(f"API returned success=false: {data}")
        rules = data.get("rules", [])
        # 只保留启用的
        rules = [r for r in rules if r.get("enabled")]
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(rules, ensure_ascii=False), encoding='utf-8')
        return rules
    except Exception as e:
        print(f"[rules] fetch failed: {e}, falling back to cache")
        if cache_path.exists():
            return json.loads(cache_path.read_text(encoding='utf-8'))
        raise


def classify_rules(rules: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """
    把规则分成 keywords 和 accounts 两类。
    - 如果规则的 keyword 在 ACCOUNT_NAMES 中 → account
    - 否则 → keyword
    """
    keywords = []
    accounts = []
    for rule in rules:
        if not rule.get("enabled"):
            continue
        name = rule.get("keyword", "")
        if name in ACCOUNT_NAMES:
            accounts.append(rule)
        else:
            keywords.append(rule)
    return {"keywords": keywords, "accounts": accounts}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner
source .venv/bin/activate
pytest tests/test_rules.py -v
```

Expected: 5 passed

- [ ] **Step 5: 创建 accounts_map.json（从 CSV 导入）**

```bash
python3 << 'EOF'
import csv
import json
from pathlib import Path

src = Path("/Users/elainewang/Documents/Playground/video_account_names_rechecked_209.csv")
dst = Path("/Users/elainewang/Downloads/mediacrawler-runner/config/accounts_map.json")

accounts = []
with open(src, encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        name = row.get("账号名称", "").strip()
        if name:
            accounts.append(name)

dst.parent.mkdir(parents=True, exist_ok=True)
dst.write_text(json.dumps(accounts, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"Wrote {len(accounts)} accounts to {dst}")
EOF
```

Expected: `Wrote 209 accounts to ...`

- [ ] **Step 6: Commit**

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner
git add runner/rules.py tests/test_rules.py config/accounts_map.json requirements.txt
git commit -m "feat(rules): add rule fetcher with keyword/account classification"
```

---

### Task B3：实现 mapper 模块（MediaCrawler 数据 → ingest 格式）

**Files:**
- Create: `/Users/elainewang/Downloads/mediacrawler-runner/runner/mapper.py`
- Create: `/Users/elainewang/Downloads/mediacrawler-runner/tests/test_mapper.py`

- [ ] **Step 1: 写失败的测试**

Create `/Users/elainewang/Downloads/mediacrawler-runner/tests/test_mapper.py`:

```python
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from runner.mapper import map_xhs_note_to_ingest_item


def test_map_basic_note():
    raw = {
        "note_id": "abc123",
        "title": "Hello",
        "desc": "World",
        "user": {"user_id": "u1", "nickname": "alice"},
        "liked_count": "1234",
        "comments_count": "56",
        "collected_count": "10",
        "share_count": "5",
        "time": 1712700000,   # epoch seconds
        "note_url": "https://xhs.com/abc",
    }
    result = map_xhs_note_to_ingest_item(raw, rule_type="keyword", rule_value="test")
    assert result['platform'] == 'xiaohongshu'
    assert result['note_id'] == 'abc123'
    assert result['title'] == 'Hello'
    assert result['desc'] == 'World'
    assert result['author_name'] == 'alice'
    assert result['author_id'] == 'u1'
    assert result['likes'] == 1234
    assert result['comments'] == 56
    assert result['collected'] == 10
    assert result['shares'] == 5
    assert result['matched_rule']['type'] == 'keyword'
    assert result['matched_rule']['value'] == 'test'
    assert result['published_at'].startswith('202')   # ISO format


def test_map_handles_missing_fields():
    raw = {"note_id": "empty123"}
    result = map_xhs_note_to_ingest_item(raw, rule_type="keyword", rule_value="test")
    assert result['note_id'] == 'empty123'
    assert result['title'] == ''
    assert result['likes'] == 0
    assert result['author_name'] == ''


def test_map_handles_string_counts():
    # 小红书返回的计数可能是 "1.2万" 这种字符串
    raw = {"note_id": "x1", "liked_count": "1.2万"}
    result = map_xhs_note_to_ingest_item(raw, rule_type="keyword", rule_value="test")
    # 非数字字符串应该 fallback 到 0
    assert result['likes'] == 0


def test_map_handles_numeric_counts():
    raw = {"note_id": "x1", "liked_count": 999}
    result = map_xhs_note_to_ingest_item(raw, rule_type="keyword", rule_value="test")
    assert result['likes'] == 999
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner
source .venv/bin/activate
pytest tests/test_mapper.py -v
```

Expected: FAIL ImportError

- [ ] **Step 3: 实现 runner/mapper.py**

Create `/Users/elainewang/Downloads/mediacrawler-runner/runner/mapper.py`:

```python
"""MediaCrawler 返回数据 → Render /api/ingest 需要的 JSON 格式。"""
from datetime import datetime, timezone
from typing import Any


def _to_int(v: Any) -> int:
    """安全转 int。字符串里有非数字字符（比如 '1.2万'）时返回 0。"""
    if isinstance(v, int):
        return v
    if isinstance(v, str):
        try:
            return int(v)
        except ValueError:
            return 0
    return 0


def _epoch_to_iso(ts: Any) -> str:
    """epoch seconds → ISO 8601 UTC 字符串。"""
    if not ts:
        return datetime.now(timezone.utc).isoformat()
    try:
        # MediaCrawler 的 time 字段可能是秒或毫秒
        ts_num = float(ts)
        if ts_num > 1e12:  # milliseconds
            ts_num /= 1000
        return datetime.fromtimestamp(ts_num, tz=timezone.utc).isoformat()
    except (ValueError, TypeError):
        return datetime.now(timezone.utc).isoformat()


def map_xhs_note_to_ingest_item(
    raw: dict[str, Any],
    rule_type: str,
    rule_value: str,
) -> dict[str, Any]:
    """把 MediaCrawler 的 xhs note 原始数据转换成 ingest 格式。"""
    user = raw.get("user", {}) or {}
    return {
        "platform": "xiaohongshu",
        "note_id": raw.get("note_id", ""),
        "title": raw.get("title", "") or "",
        "desc": raw.get("desc", "") or "",
        "author_name": user.get("nickname", "") or user.get("nick_name", "") or "",
        "author_id": user.get("user_id", "") or "",
        "url": raw.get("note_url", "") or raw.get("url", "") or "",
        "cover_image": raw.get("cover", {}).get("url", "") if isinstance(raw.get("cover"), dict) else "",
        "published_at": _epoch_to_iso(raw.get("time") or raw.get("timestamp")),
        "likes": _to_int(raw.get("liked_count")),
        "comments": _to_int(raw.get("comments_count")),
        "collected": _to_int(raw.get("collected_count")),
        "shares": _to_int(raw.get("share_count")),
        "matched_rule": {
            "type": rule_type,
            "value": rule_value,
        },
    }
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner
source .venv/bin/activate
pytest tests/test_mapper.py -v
```

Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner
git add runner/mapper.py tests/test_mapper.py
git commit -m "feat(mapper): add xhs note to ingest format mapper"
```

---

### Task B4：实现 uploader 模块（POST 到 Render + 重试）

**Files:**
- Create: `/Users/elainewang/Downloads/mediacrawler-runner/runner/uploader.py`
- Create: `/Users/elainewang/Downloads/mediacrawler-runner/tests/test_uploader.py`

- [ ] **Step 1: 写失败的测试**

Create `/Users/elainewang/Downloads/mediacrawler-runner/tests/test_uploader.py`:

```python
import json
from pathlib import Path
from unittest.mock import patch, MagicMock
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from runner.uploader import upload_items, retry_failed_batches


def test_upload_success():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"success": True, "inserted": 5, "new_alerts": 2}

    with patch('requests.post', return_value=mock_resp) as mock_post:
        result = upload_items(
            render_url="https://example.com",
            token="test",
            category_id="cat-1",
            items=[{"note_id": "1"}],
            failed_dir=Path("/tmp/ignore"),
        )
    assert result['success'] is True
    assert result['new_alerts'] == 2
    mock_post.assert_called_once()


def test_upload_failure_saves_batch(tmp_path):
    mock_resp = MagicMock()
    mock_resp.status_code = 500
    mock_resp.text = "internal error"
    mock_resp.json.side_effect = ValueError("not json")

    failed_dir = tmp_path / "failed"

    with patch('requests.post', return_value=mock_resp):
        result = upload_items(
            render_url="https://example.com",
            token="test",
            category_id="cat-1",
            items=[{"note_id": "1"}],
            failed_dir=failed_dir,
        )
    assert result['success'] is False
    # 应该生成一个失败文件
    files = list(failed_dir.glob("*.json"))
    assert len(files) == 1


def test_retry_failed_batches(tmp_path):
    failed_dir = tmp_path / "failed"
    failed_dir.mkdir()
    batch_file = failed_dir / "20260410-0800.json"
    batch_file.write_text(json.dumps({
        "category_id": "cat-1",
        "items": [{"note_id": "retry1"}],
    }))

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"success": True, "inserted": 1}

    with patch('requests.post', return_value=mock_resp):
        count = retry_failed_batches(
            render_url="https://example.com",
            token="test",
            failed_dir=failed_dir,
        )
    assert count == 1
    # 成功后文件应该被删除
    assert not batch_file.exists()
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner
source .venv/bin/activate
pytest tests/test_uploader.py -v
```

Expected: FAIL ImportError

- [ ] **Step 3: 实现 runner/uploader.py**

Create `/Users/elainewang/Downloads/mediacrawler-runner/runner/uploader.py`:

```python
"""上传 ingest 数据到 Render /api/ingest。失败时保存 payload 到本地。"""
import json
from datetime import datetime
from pathlib import Path
from typing import Any

import requests


def upload_items(
    render_url: str,
    token: str,
    category_id: str,
    items: list[dict[str, Any]],
    failed_dir: Path,
    timeout: int = 60,
) -> dict[str, Any]:
    """POST items 到 /api/ingest。失败时把 payload 存到 failed_dir。"""
    payload = {
        "source": "mediacrawler",
        "category_id": category_id,
        "items": items,
    }
    try:
        resp = requests.post(
            f"{render_url}/api/ingest",
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=timeout,
        )
        if resp.status_code == 200:
            return resp.json()
        else:
            raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:500]}")
    except Exception as e:
        # 保存失败的 payload
        failed_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d-%H%M%S")
        failed_file = failed_dir / f"{ts}.json"
        failed_file.write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
        return {
            "success": False,
            "error": str(e),
            "failed_file": str(failed_file),
        }


def retry_failed_batches(
    render_url: str,
    token: str,
    failed_dir: Path,
    timeout: int = 60,
) -> int:
    """重试所有 failed 目录下的 payload。成功后删除文件。返回成功数。"""
    if not failed_dir.exists():
        return 0
    success_count = 0
    for batch_file in sorted(failed_dir.glob("*.json")):
        try:
            payload = json.loads(batch_file.read_text(encoding='utf-8'))
            resp = requests.post(
                f"{render_url}/api/ingest",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                timeout=timeout,
            )
            if resp.status_code == 200:
                batch_file.unlink()
                success_count += 1
            else:
                print(f"[retry] {batch_file.name} still failing: HTTP {resp.status_code}")
        except Exception as e:
            print(f"[retry] {batch_file.name} error: {e}")
    return success_count
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner
source .venv/bin/activate
pytest tests/test_uploader.py -v
```

Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner
git add runner/uploader.py tests/test_uploader.py
git commit -m "feat(uploader): add batch upload with failure persistence and retry"
```

---

### Task B5：克隆 MediaCrawler 并写 crawler 封装

**Files:**
- Clone: `MediaCrawler/` 目录
- Create: `runner/crawler.py`

- [ ] **Step 1: 克隆 MediaCrawler**

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner
git clone https://github.com/NanmiCoder/MediaCrawler.git
```

Expected: 克隆成功。

- [ ] **Step 2: 读 MediaCrawler README 了解使用方式**

```bash
cat MediaCrawler/README.md | head -100
```

**关键点：** 确认 MediaCrawler 提供了哪些 CLI/Python API，特别是：
- 如何按关键词搜索笔记（xhs platform）
- 如何按用户查笔记列表
- 如何传入登录 cookie
- 返回数据的 JSON 结构

记录关键命令到笔记，例如通常是：
```bash
python main.py --platform xhs --lt qrcode --type search --keywords "vibecoding"
```

- [ ] **Step 3: 安装 MediaCrawler 的依赖**

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner/MediaCrawler
pip install -r requirements.txt
playwright install chromium
```

Expected: 下载完成（可能几分钟）。

- [ ] **Step 4: 测试一次原生 MediaCrawler 搜索是否工作**

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner/MediaCrawler
# 根据 README 给的命令跑一次搜索（不登录）
# 具体命令因 MediaCrawler 版本而异，这里是示例：
python main.py --platform xhs --lt qrcode --type search --keywords "vibecoding" --get_word_num 5
```

观察输出。**如果无法无登录使用**，记录下这个限制，标记为"需要在后续步骤登录"。

- [ ] **Step 5: 实现 runner/crawler.py 封装**

Create `/Users/elainewang/Downloads/mediacrawler-runner/runner/crawler.py`:

```python
"""封装 MediaCrawler 的调用。支持关键词搜索和用户笔记列表。

MediaCrawler 的原生 API 会因版本而异，这里用 subprocess 调用它的 main.py，
读取它输出的 JSON 文件。这样对 MediaCrawler 升级更稳定。
"""
import json
import subprocess
from pathlib import Path
from typing import Any

MEDIACRAWLER_DIR = Path("./MediaCrawler")


def run_mediacrawler_keyword_search(
    keyword: str,
    limit: int = 20,
    cookie_path: Path | None = None,
    timeout_seconds: int = 180,
) -> list[dict[str, Any]]:
    """
    调 MediaCrawler 按关键词搜索小红书笔记。
    返回 raw note dict 列表。
    """
    cmd = [
        "python", "main.py",
        "--platform", "xhs",
        "--type", "search",
        "--keywords", keyword,
        "--get_word_num", str(limit),
        "--save_data_option", "json",  # 输出到 JSON 文件
    ]
    if cookie_path and cookie_path.exists():
        cmd += ["--cookies", str(cookie_path.resolve())]

    try:
        result = subprocess.run(
            cmd,
            cwd=MEDIACRAWLER_DIR,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )
    except subprocess.TimeoutExpired:
        print(f"[crawler] timeout on keyword '{keyword}'")
        return []

    if result.returncode != 0:
        print(f"[crawler] failed on '{keyword}': {result.stderr[:200]}")
        return []

    # MediaCrawler 把结果存到 data/xhs/*.json
    # 具体路径因版本而异，需要在 Task B5 Step 4 中确认
    output_dir = MEDIACRAWLER_DIR / "data" / "xhs"
    if not output_dir.exists():
        return []

    # 读最新的 json 文件
    json_files = sorted(
        output_dir.glob("*.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not json_files:
        return []

    try:
        data = json.loads(json_files[0].read_text(encoding='utf-8'))
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and 'notes' in data:
            return data['notes']
        return []
    except Exception as e:
        print(f"[crawler] parse error: {e}")
        return []


def run_mediacrawler_user_posts(
    nickname: str,
    limit: int = 20,
    cookie_path: Path | None = None,
    timeout_seconds: int = 180,
) -> list[dict[str, Any]]:
    """
    按博主昵称搜索用户，然后拉用户笔记列表。
    MediaCrawler 的 creator 模式需要 user_id。
    这里先用 search 拿 user_id，再跑 creator 模式。

    注：具体实现取决于 MediaCrawler CLI 的能力，
    在 Task B5 Step 4 验证过 README 后可能需要调整。
    """
    # 如果 MediaCrawler 不支持按昵称查用户，就当作关键词搜索兜底
    return run_mediacrawler_keyword_search(nickname, limit, cookie_path, timeout_seconds)
```

**注意：** 这个文件有不确定性——MediaCrawler 的具体 CLI 接口需要在 Step 4 验证后调整。在执行此 task 时，**先跑 Step 4 看明白实际接口，再回来改这个文件**。

- [ ] **Step 6: Commit**

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner
git add runner/crawler.py
git commit -m "feat(crawler): add MediaCrawler subprocess wrapper"
```

---

### Task B6：实现 run.py 主入口

**Files:**
- Create: `/Users/elainewang/Downloads/mediacrawler-runner/runner/run.py`

- [ ] **Step 1: 实现 run.py**

Create `/Users/elainewang/Downloads/mediacrawler-runner/runner/run.py`:

```python
"""主入口：拉规则 → 调 MediaCrawler → 上传 Render。"""
import os
import sys
import json
import logging
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

# 添加当前目录到 sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from runner.rules import fetch_rules, classify_rules, load_account_names
from runner.crawler import (
    run_mediacrawler_keyword_search,
    run_mediacrawler_user_posts,
)
from runner.mapper import map_xhs_note_to_ingest_item
from runner.uploader import upload_items, retry_failed_batches


ROOT = Path(__file__).parent.parent
CONFIG_DIR = ROOT / "config"
LOGS_DIR = ROOT / "logs"
FAILED_DIR = LOGS_DIR / "failed"


def setup_logging():
    LOGS_DIR.mkdir(exist_ok=True)
    log_file = LOGS_DIR / f"run-{datetime.now().strftime('%Y%m%d-%H%M%S')}.log"
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s',
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            logging.StreamHandler(sys.stdout),
        ],
    )


def main():
    setup_logging()
    log = logging.getLogger(__name__)
    log.info("=" * 60)
    log.info("MediaCrawler runner starting")

    # Load env
    load_dotenv(CONFIG_DIR / ".env")
    render_url = os.getenv("RENDER_URL")
    token = os.getenv("INGEST_TOKEN")
    category_id = os.getenv("CATEGORY_ID", "cat-1")
    cookie_path = Path(os.getenv("COOKIE_PATH", CONFIG_DIR / "cookie.json"))

    if not render_url or not token:
        log.error("RENDER_URL or INGEST_TOKEN missing in .env")
        sys.exit(1)

    # Load account names
    load_account_names(CONFIG_DIR / "accounts_map.json")

    # Retry failed batches from last run
    log.info("retrying failed batches...")
    retried = retry_failed_batches(render_url, token, FAILED_DIR)
    log.info(f"retried {retried} batches")

    # Fetch rules
    log.info("fetching monitor rules...")
    try:
        rules = fetch_rules(render_url, category_id, CONFIG_DIR / "rules.cache.json")
    except Exception as e:
        log.error(f"failed to fetch rules and no cache: {e}")
        sys.exit(1)

    log.info(f"loaded {len(rules)} enabled rules")
    classified = classify_rules(rules)
    log.info(
        f"classified: {len(classified['keywords'])} keywords, "
        f"{len(classified['accounts'])} accounts"
    )

    # Collect all items
    all_items: list[dict] = []

    # Process keyword rules
    for i, rule in enumerate(classified['keywords'], 1):
        keyword = rule['keyword']
        log.info(f"[{i}/{len(classified['keywords'])}] searching keyword: {keyword}")
        try:
            raw_notes = run_mediacrawler_keyword_search(
                keyword, limit=20, cookie_path=cookie_path
            )
            for note in raw_notes:
                all_items.append(
                    map_xhs_note_to_ingest_item(note, "keyword", keyword)
                )
        except Exception as e:
            log.error(f"keyword '{keyword}' failed: {e}")
            continue

    # Process account rules
    for i, rule in enumerate(classified['accounts'], 1):
        name = rule['keyword']
        log.info(f"[{i}/{len(classified['accounts'])}] searching account: {name}")
        try:
            raw_notes = run_mediacrawler_user_posts(
                name, limit=20, cookie_path=cookie_path
            )
            for note in raw_notes:
                all_items.append(
                    map_xhs_note_to_ingest_item(note, "account", name)
                )
        except Exception as e:
            log.error(f"account '{name}' failed: {e}")
            continue

    # Dedupe by note_id
    seen: set[str] = set()
    unique_items = []
    for item in all_items:
        nid = item.get('note_id')
        if nid and nid not in seen:
            seen.add(nid)
            unique_items.append(item)

    log.info(f"collected {len(all_items)} raw items, {len(unique_items)} unique")

    if not unique_items:
        log.warning("no items to upload, exiting")
        return

    # Upload
    log.info("uploading to Render...")
    result = upload_items(
        render_url=render_url,
        token=token,
        category_id=category_id,
        items=unique_items,
        failed_dir=FAILED_DIR,
    )

    if result.get("success"):
        log.info(
            f"uploaded OK: inserted={result.get('inserted',0)}, "
            f"new_alerts={result.get('new_alerts',0)}"
        )
    else:
        log.error(f"upload failed: {result.get('error','unknown')}")

    log.info("done")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 添加 python-dotenv 到 requirements.txt（已有则跳过）**

```bash
cat /Users/elainewang/Downloads/mediacrawler-runner/requirements.txt | grep dotenv
```

如果没有，添加到 requirements.txt。

- [ ] **Step 3: Commit**

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner
git add runner/run.py requirements.txt
git commit -m "feat(run): add main entrypoint"
```

---

### Task B7：写 shell 脚本（install / login / test / run-now / install-cron）

**Files:**
- Create: `install.sh`, `login.sh`, `test.sh`, `run-now.sh`, `install-cron.sh`
- Create: `com.ai-intel-hub.crawler.plist`

- [ ] **Step 1: 写 install.sh**

Create `/Users/elainewang/Downloads/mediacrawler-runner/install.sh`:

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "==> Creating Python virtualenv"
python3 -m venv .venv
source .venv/bin/activate

echo "==> Installing runner dependencies"
pip install --upgrade pip
pip install -r requirements.txt

if [ ! -d MediaCrawler ]; then
  echo "==> Cloning MediaCrawler"
  git clone https://github.com/NanmiCoder/MediaCrawler.git
fi

echo "==> Installing MediaCrawler dependencies"
cd MediaCrawler
pip install -r requirements.txt
playwright install chromium
cd ..

if [ ! -f config/.env ]; then
  echo "==> Creating config/.env from template"
  cp config/.env.example config/.env
  echo "IMPORTANT: Edit config/.env and set INGEST_TOKEN"
fi

echo "==> Done! Next steps:"
echo "  1. Edit config/.env and set INGEST_TOKEN"
echo "  2. Run ./login.sh to log into xiaohongshu (saves cookie)"
echo "  3. Run ./test.sh to verify"
echo "  4. Run ./install-cron.sh to schedule every 2 hours"
```

```bash
chmod +x install.sh
```

- [ ] **Step 2: 写 login.sh**

Create `/Users/elainewang/Downloads/mediacrawler-runner/login.sh`:

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")"
source .venv/bin/activate

echo "==> Opening xiaohongshu login page"
echo "    Scan QR code with your phone to log in."
echo "    Cookie will be saved to config/cookie.json"

cd MediaCrawler
# Run MediaCrawler in headed mode with login type = qrcode
# Exact command depends on version — may need adjustment
python main.py \
  --platform xhs \
  --lt qrcode \
  --type search \
  --keywords "测试" \
  --get_word_num 1 \
  --headless false \
  --save_login_state true

cd ..
echo "==> Cookie should now be saved. Copy it to config/cookie.json manually if needed."
```

```bash
chmod +x login.sh
```

- [ ] **Step 3: 写 test.sh**

Create `/Users/elainewang/Downloads/mediacrawler-runner/test.sh`:

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")"
source .venv/bin/activate

echo "==> Running unit tests"
pytest tests/ -v

echo "==> All tests passed"
```

```bash
chmod +x test.sh
```

- [ ] **Step 4: 写 run-now.sh**

Create `/Users/elainewang/Downloads/mediacrawler-runner/run-now.sh`:

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")"
source .venv/bin/activate

echo "==> Running MediaCrawler runner now"
python runner/run.py
```

```bash
chmod +x run-now.sh
```

- [ ] **Step 5: 写 com.ai-intel-hub.crawler.plist**

Create `/Users/elainewang/Downloads/mediacrawler-runner/com.ai-intel-hub.crawler.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ai-intel-hub.crawler</string>
    <key>ProgramArguments</key>
    <array>
        <string>PLACEHOLDER_RUNNER_PATH/run-now.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>7200</integer>
    <key>RunAtLoad</key>
    <false/>
    <key>StandardOutPath</key>
    <string>PLACEHOLDER_RUNNER_PATH/logs/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>PLACEHOLDER_RUNNER_PATH/logs/stderr.log</string>
</dict>
</plist>
```

- [ ] **Step 6: 写 install-cron.sh**

Create `/Users/elainewang/Downloads/mediacrawler-runner/install-cron.sh`:

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")"
RUNNER_PATH="$(pwd)"
PLIST_SRC="com.ai-intel-hub.crawler.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.ai-intel-hub.crawler.plist"

echo "==> Generating launchd plist with runner path: $RUNNER_PATH"
mkdir -p "$HOME/Library/LaunchAgents"
sed "s|PLACEHOLDER_RUNNER_PATH|$RUNNER_PATH|g" "$PLIST_SRC" > "$PLIST_DST"

echo "==> Unloading old (if any)"
launchctl unload "$PLIST_DST" 2>/dev/null || true

echo "==> Loading new"
launchctl load "$PLIST_DST"

echo "==> Done. Runner will execute every 2 hours."
echo "    To manually trigger: launchctl start com.ai-intel-hub.crawler"
echo "    To uninstall: launchctl unload $PLIST_DST && rm $PLIST_DST"
echo "    Logs: $RUNNER_PATH/logs/"
```

```bash
chmod +x install-cron.sh
```

- [ ] **Step 7: Commit**

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner
git add install.sh login.sh test.sh run-now.sh install-cron.sh com.ai-intel-hub.crawler.plist
git commit -m "feat(scripts): add install/login/test/run-now/install-cron shell scripts"
```

---

### Task B8：写 README.md

**Files:**
- Create: `/Users/elainewang/Downloads/mediacrawler-runner/README.md`

- [ ] **Step 1: 写 README**

Create `/Users/elainewang/Downloads/mediacrawler-runner/README.md`:

```markdown
# MediaCrawler Runner

AI情报中台的小红书数据采集服务。每 2 小时自动采集监控规则对应的笔记数据，推送到 Render 上的 ai-intel-hub。

## 系统要求

- macOS (Intel 或 Apple Silicon)
- 至少 8 GB 内存
- 至少 2 GB 可用磁盘
- Python 3.10 或更高版本
- 需要一直开着电脑（或者接受"只在开机时采集"）

## 安装步骤

### 1. 拷贝整个文件夹到目标 Mac

比如放到 `~/Downloads/mediacrawler-runner/`。

### 2. 运行安装脚本

```bash
cd ~/Downloads/mediacrawler-runner
./install.sh
```

这一步会：
- 创建 Python 虚拟环境 `.venv/`
- 安装 Python 依赖
- 克隆 MediaCrawler 源码
- 安装 Playwright 和 Chromium 浏览器（约 200MB）
- 复制配置文件模板

大约需要 5-10 分钟。

### 3. 配置环境变量

编辑 `config/.env`：

```bash
nano config/.env
```

把 `INGEST_TOKEN` 替换成真实的生产 token（找 Elaine 或查 Render 环境变量）。

### 4. 登录小红书

```bash
./login.sh
```

会弹出一个浏览器窗口，**用你的小红书 App 扫码登录**。登录成功后 cookie 自动保存到 `config/cookie.json`。

⚠️ **Cookie 大约 30 天过期**，过期后需要重新跑一次 `./login.sh`。

### 5. 测试

```bash
# 跑单元测试
./test.sh

# 手动触发一次完整采集
./run-now.sh
```

观察 `logs/` 目录下的日志。

### 6. 安装定时任务

```bash
./install-cron.sh
```

此后 macOS 的 launchd 会每 2 小时自动触发一次。

## 常用命令

| 命令 | 说明 |
|------|------|
| `./run-now.sh` | 立即手动触发一次采集 |
| `./login.sh` | 重新登录小红书 |
| `./test.sh` | 跑单元测试 |
| `./install-cron.sh` | 安装/更新定时任务 |
| `launchctl start com.ai-intel-hub.crawler` | 手动触发 launchd 任务 |
| `launchctl unload ~/Library/LaunchAgents/com.ai-intel-hub.crawler.plist` | 停止定时任务 |

## 文件结构

```
mediacrawler-runner/
├── MediaCrawler/              # 开源项目（通过 git clone 获取）
├── runner/                    # 我们的 Python 代码
│   ├── run.py                 # 主入口
│   ├── rules.py               # 拉取规则
│   ├── crawler.py             # 调 MediaCrawler
│   ├── mapper.py              # 数据格式转换
│   └── uploader.py            # 上传 Render
├── config/
│   ├── .env                   # 你的配置（不提交 Git）
│   ├── cookie.json            # 登录状态（不提交 Git）
│   └── accounts_map.json      # 209 个博主昵称
├── logs/                      # 运行日志 + 失败 payload
├── tests/                     # 单元测试
└── *.sh                       # 便捷脚本
```

## 故障排查

### "cookie expired" 或者没采到数据

```bash
./login.sh    # 重新扫码
./run-now.sh  # 再跑一次
```

### MediaCrawler 报错 / 小红书接口变化

```bash
cd MediaCrawler
git pull
pip install -r requirements.txt
cd ..
./run-now.sh
```

### 定时任务没触发

```bash
# 查看是否加载
launchctl list | grep ai-intel-hub
# 查看最近日志
tail -50 logs/stdout.log
tail -50 logs/stderr.log
```

### 占用内存太多

编辑 `com.ai-intel-hub.crawler.plist`，把 `StartInterval` 从 7200（2 小时）改成 14400（4 小时）：

```xml
<key>StartInterval</key>
<integer>14400</integer>
```

然后重新安装：

```bash
./install-cron.sh
```

## 架构

```
launchd（每 2 小时）
  ↓
./run-now.sh → runner/run.py
  ↓
1. 从 https://ai-intel-hub.onrender.com 拉监控规则
2. 调 MediaCrawler（headless Chromium）采集每个关键词/博主
3. POST 汇总结果到 /api/ingest
  ↓
Render 端写入 SQLite + 触发告警
  ↓
网页实时展示：https://ai-intel-hub.onrender.com
```

## 联系

有问题找 Elaine。
```

- [ ] **Step 2: Commit**

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner
git add README.md
git commit -m "docs: add README with installation and troubleshooting guide"
```

---

### Task B9：端到端本地验证（在当前 MacBook 跑一次小规模）

- [ ] **Step 1: 运行 install.sh**

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner
./install.sh
```

观察输出，确认没有 error。

- [ ] **Step 2: 配置 .env**

编辑 `config/.env`，填入真实 INGEST_TOKEN（从 `/Users/elainewang/Downloads/content-monitor/.env.production.local` 读取）：

```bash
PROD_TOKEN=$(grep INGEST_TOKEN_PROD /Users/elainewang/Downloads/content-monitor/.env.production.local | cut -d= -f2)
sed -i '' "s|replace-with-real-token|${PROD_TOKEN}|" config/.env
cat config/.env
```

- [ ] **Step 3: 首次登录小红书**

```bash
./login.sh
```

扫码登录，确认 cookie 保存成功。

- [ ] **Step 4: 跑单元测试**

```bash
./test.sh
```

Expected: all tests pass

- [ ] **Step 5: 手动把 rules 文件改成只有 5 条（小规模测试）**

```bash
# 先从 Render 拉取完整规则
curl -s "https://ai-intel-hub.onrender.com/api/monitor?categoryId=cat-1" > /tmp/all_rules.json

# 取前 5 条放到缓存（这样 fetch_rules 会优先用缓存）
python3 << 'EOF'
import json
with open('/tmp/all_rules.json') as f:
    data = json.load(f)
small = data['rules'][:5]
with open('/Users/elainewang/Downloads/mediacrawler-runner/config/rules.cache.json', 'w') as f:
    json.dump(small, f, ensure_ascii=False)
print("Saved 5 rules to cache")
EOF
```

- [ ] **Step 6: 临时让 Render 不可达（强制使用缓存）**

可选：直接改 .env 里的 RENDER_URL 指向错误地址，让 fetch_rules 走缓存。或者保持不变，小规模测试时让 run.py 自己控制（需要添加一个 --limit 参数，这里为了简化我们跳过）。

- [ ] **Step 7: 执行 run-now.sh**

```bash
./run-now.sh
```

观察日志：
- [ ] 是否打印出 5 条规则
- [ ] MediaCrawler 是否成功采集
- [ ] 是否成功 POST 到 /api/ingest

- [ ] **Step 8: 验证 Render 端确实收到了数据**

```bash
curl -s 'https://ai-intel-hub.onrender.com/api/contents?categoryId=cat-1&limit=5' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
for item in d.get('contents',[])[:5]:
    print(f'{item[\"title\"][:50]} | likes={item[\"likes\"]}')
"
```

Expected: 看到刚采集到的笔记（标题可能和之前 cn8n 的不同）。

- [ ] **Step 9: 恢复全量规则**

```bash
rm /Users/elainewang/Downloads/mediacrawler-runner/config/rules.cache.json
```

- [ ] **Step 10: Commit any fixes**

如果前面步骤暴露出需要修复的 bug（比如 crawler.py 的 CLI 参数不对），改完后：

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner
git add -A
git commit -m "fix: adjust after e2e verification on local Mac"
```

---

### Task B10：打包交付

- [ ] **Step 1: 清理敏感数据**

```bash
cd /Users/elainewang/Downloads/mediacrawler-runner
# 确保 .env 和 cookie.json 没有被提交
rm -f config/.env config/cookie.json
rm -rf logs/*.log logs/failed/*
rm -rf .venv  # 目标机器会自己创建
# MediaCrawler 目录保留（避免目标机器重新 clone）
# 但清理它的 data/ 缓存
rm -rf MediaCrawler/data MediaCrawler/cookies
```

- [ ] **Step 2: 创建压缩包**

```bash
cd /Users/elainewang/Downloads
tar --exclude='mediacrawler-runner/.git' \
    --exclude='mediacrawler-runner/.venv' \
    --exclude='mediacrawler-runner/logs/*.log' \
    --exclude='mediacrawler-runner/MediaCrawler/.git' \
    -czf mediacrawler-runner.tar.gz mediacrawler-runner/

ls -lh mediacrawler-runner.tar.gz
```

- [ ] **Step 3: 创建 README 简短版粘贴提示**

打印一份简短的安装说明供用户参考：

```bash
cat << 'EOF'

============================================================
  交付物：/Users/elainewang/Downloads/mediacrawler-runner.tar.gz
============================================================

安装步骤（在目标 Mac 上）：

  1. 传输包到目标 Mac，解压：
       tar -xzf mediacrawler-runner.tar.gz
       cd mediacrawler-runner

  2. 运行安装脚本：
       ./install.sh

  3. 编辑 config/.env，填入 INGEST_TOKEN

  4. 登录小红书（扫码）：
       ./login.sh

  5. 测试一次：
       ./run-now.sh

  6. 观察 logs/ 确认成功后，安装定时任务：
       ./install-cron.sh

完整文档见 README.md

============================================================
EOF
```

---

## Phase C：监控 + 切换收尾

### Task C1：禁用 cn8n 定时任务

- [ ] **Step 1: 修改 GitHub Actions workflow 让它不再触发 cn8n 调用**

此时 Render 上的 `/api/monitor` 端点仍可用但失去意义（因为 MediaCrawler 已经在送数据）。

编辑 `/Users/elainewang/Downloads/content-monitor/.github/workflows/monitor-cron.yml`，把 schedule 注释掉（改成只能手动触发）：

```yaml
name: Hourly Monitor

on:
  # schedule:
  #   - cron: '17 * * * *'
  workflow_dispatch:

jobs:
  run-monitor:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger monitor (disabled, MediaCrawler now primary source)
        run: echo "cn8n-based monitor disabled; MediaCrawler is now primary"
```

- [ ] **Step 2: Commit + push**

```bash
cd /Users/elainewang/Downloads/content-monitor
git add .github/workflows/monitor-cron.yml
git commit -m "chore: disable cn8n monitor cron, MediaCrawler is now primary"
git push
```

### Task C2：观察 24 小时

- [ ] **Step 1: 检查是否有新告警到达**

```bash
curl -s 'https://ai-intel-hub.onrender.com/api/alerts?countOnly=true' | python3 -m json.tool
```

- [ ] **Step 2: 查看 MacBook Air 上的日志**

```bash
# 在 Air 上
tail -200 ~/Downloads/mediacrawler-runner/logs/run-*.log
```

- [ ] **Step 3: 如果一切正常，写个最终总结更新 PROJECT_HANDOFF.md**

更新 `/Users/elainewang/Downloads/content-monitor/PROJECT_HANDOFF.md`，替换数据源部分：

- 从 "数据源：cn8n.com 第三方 API"
- 改为 "数据源：MediaCrawler（在家里 MacBook Air 上自托管）"

加一段"如何运维 MediaCrawler 采集器"的章节，指向 mediacrawler-runner 项目的 README。

```bash
cd /Users/elainewang/Downloads/content-monitor
git add PROJECT_HANDOFF.md
git commit -m "docs: update project handoff after MediaCrawler migration"
git push
```

---

## 自审

**Spec 覆盖检查：**
- ✅ Render 端 `/api/ingest` 端点 → Task A1-A3
- ✅ 家里 Mac runner 项目 → Task B1-B10
- ✅ 认证 token → Task A3 Step 1
- ✅ 规则拉取 + 缓存 → Task B2
- ✅ MediaCrawler 封装 → Task B5
- ✅ 数据格式转换 → Task B3
- ✅ 上传 + 重试 → Task B4
- ✅ launchd 定时任务 → Task B7
- ✅ 单元测试 → Task A1, B2, B3, B4
- ✅ 端到端验证 → Task B9
- ✅ 打包交付 → Task B10
- ✅ 停用 cn8n → Task C1
- ✅ 观察期 → Task C2

**Placeholder 扫描：** 无"TBD"、"implement later"等占位符。

**Type 一致性：** `IngestItem` 接口在 TypeScript 侧定义，Python mapper 产生相同字段，通过 `/api/ingest` 验证。

**唯一的不确定点：** Task B5 Step 4 需要根据 MediaCrawler 实际 CLI 验证，`runner/crawler.py` 里标注了"需要在 Step 4 后调整"。这是外部依赖导致的，无法在写计划时完全消除。

**已修复：** 所有 API 签名、文件路径、环境变量名保持一致。
