// ===== Types =====
export interface ContentItem {
  id: string;
  title: string;
  platform: string;
  author: string;
  publishedAt: string; // ISO date string
  likes: number;
  comments: number;
  shares: number;
  collected?: number;
  url: string;
  summary: string;
}

export interface TopicSuggestion {
  id: string;
  title: string;
  description: string;
  whyDoThis: string;
  growthPotential: string;
  relatedContents: string[];
  score: number; // 1-100
}

export interface DailyReport {
  date: string; // YYYY-MM-DD
  summary: string;
  hotTopics: string[];
  topicSuggestions: TopicSuggestion[];
  contentAnalyzed: number;
}

export interface MonitorKeyword {
  id: string;
  keyword: string;
  platforms: string[];
  enabled: boolean;
}

export interface MonitorBlogger {
  id: string;
  name: string;
  platform: string;
  platformId: string;
  avatar: string;
  followers: string;
  enabled: boolean;
}

export interface MonitorCategory {
  id: string;
  name: string;
  platforms: string[];
  keywords: MonitorKeyword[];
  bloggers: MonitorBlogger[];
  contents: ContentItem[];
  reports: DailyReport[];
}

// ===== Platforms =====
export const ALL_PLATFORMS = [
  { id: 'douyin', name: '抖音', icon: '🎵', color: '#000000' },
  { id: 'xiaohongshu', name: '小红书', icon: '📕', color: '#FF2442' },
  { id: 'weibo', name: '微博', icon: '🔴', color: '#FF8200' },
  { id: 'bilibili', name: 'B站', icon: '📺', color: '#00A1D6' },
  { id: 'twitter', name: 'X/Twitter', icon: '𝕏', color: '#1DA1F2' },
  { id: 'zhihu', name: '知乎', icon: '💡', color: '#0066FF' },
  { id: 'wechat', name: '微信公众号', icon: '💬', color: '#07C160' },
];

// ===== Helper: generate dates =====
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function dateTimeAgo(daysBack: number, hour: number, min: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

// ===== Category 1: Claude Code 选题监控 =====
const claudeCodeContents: ContentItem[] = [
  // Today
  { id: 'cc-1', title: 'Claude Code 最新更新：支持 MCP 协议，开发效率提升 300%', platform: 'twitter', author: 'AnthropicAI', publishedAt: dateTimeAgo(0, 10, 30), likes: 8420, comments: 1230, shares: 3200, url: '#', summary: 'Anthropic 发布了 Claude Code 的重大更新，新增 MCP（Model Context Protocol）支持，允许开发者连接各种外部工具和数据源。' },
  { id: 'cc-2', title: '用 Claude Code 一小时搭建完整电商后台系统', platform: 'bilibili', author: '程序员小王', publishedAt: dateTimeAgo(0, 14, 0), likes: 15600, comments: 2340, shares: 4500, url: '#', summary: '实测使用 Claude Code 从零搭建电商后台，包含商品管理、订单系统、用户管理等核心模块。' },
  { id: 'cc-3', title: 'Claude Code vs Cursor：2026年AI编程工具深度对比', platform: 'zhihu', author: 'AI工具测评师', publishedAt: dateTimeAgo(0, 9, 15), likes: 3200, comments: 890, shares: 1100, url: '#', summary: '从代码生成质量、上下文理解能力、工具链集成等多个维度深度对比两款主流AI编程工具。' },
  { id: 'cc-4', title: '我用Claude Code重构了整个项目，说说真实感受', platform: 'xiaohongshu', author: '独立开发者阿杰', publishedAt: dateTimeAgo(0, 16, 45), likes: 6700, comments: 1560, shares: 2100, url: '#', summary: '一个月的重构之旅，记录使用 Claude Code 将 10 万行 Java 项目迁移到 TypeScript 的全过程。' },
  { id: 'cc-5', title: '#ClaudeCode 让我从前端小白变全栈，不敢信', platform: 'douyin', author: '码农日记', publishedAt: dateTimeAgo(0, 20, 0), likes: 45000, comments: 5600, shares: 12000, url: '#', summary: '展示了一个设计师如何借助 Claude Code 在一周内学会全栈开发并上线了自己的产品。' },

  // 1 day ago
  { id: 'cc-6', title: 'Claude Code 的 Agent 模式到底有多强？实测给你看', platform: 'bilibili', author: '技术胖', publishedAt: dateTimeAgo(1, 10, 0), likes: 23000, comments: 3400, shares: 7800, url: '#', summary: '深度测试 Claude Code 的 Agent 模式，让它自主完成一个完整的项目需求，包括代码编写、测试和部署。' },
  { id: 'cc-7', title: '为什么说 Claude Code 改变了独立开发者的游戏规则', platform: 'wechat', author: 'IndieHacker周刊', publishedAt: dateTimeAgo(1, 8, 30), likes: 4500, comments: 670, shares: 1800, url: '#', summary: '分析了Claude Code对独立开发者生态的影响，以及如何利用它降低开发成本。' },
  { id: 'cc-8', title: 'Claude Code + Vercel = 10分钟上线一个SaaS产品', platform: 'twitter', author: 'levelsio', publishedAt: dateTimeAgo(1, 15, 20), likes: 12000, comments: 2100, shares: 5600, url: '#', summary: 'Pieter Levels 展示了如何用 Claude Code 快速构建并通过 Vercel 部署一个完整的 SaaS 产品。' },
  { id: 'cc-9', title: '小红书博主亲测：用AI写代码做了个记账App', platform: 'xiaohongshu', author: '数码少女Lily', publishedAt: dateTimeAgo(1, 19, 0), likes: 8900, comments: 2300, shares: 3400, url: '#', summary: '一个完全不会编程的博主使用Claude Code完成了一个精美的记账App的开发过程分享。' },
  { id: 'cc-10', title: '别再只用Claude Code写代码了，这些用法更香', platform: 'weibo', author: '科技每日精选', publishedAt: dateTimeAgo(1, 12, 0), likes: 5600, comments: 780, shares: 2100, url: '#', summary: '分享了Claude Code在文档生成、代码审查、架构设计、数据分析等非编码场景的使用技巧。' },

  // 2 days ago
  { id: 'cc-11', title: 'Claude Code 终端模式入门到精通完全指南', platform: 'zhihu', author: '全栈之路', publishedAt: dateTimeAgo(2, 9, 0), likes: 7800, comments: 1200, shares: 3200, url: '#', summary: '从安装配置到高级用法，覆盖Claude Code CLI的所有核心功能。' },
  { id: 'cc-12', title: '震惊！AI写的代码比高级工程师还好？', platform: 'douyin', author: '编程达人秀', publishedAt: dateTimeAgo(2, 18, 30), likes: 67000, comments: 8900, shares: 15000, url: '#', summary: '对比测试Claude Code与3名高级工程师完成相同编程任务的代码质量和速度。' },
  { id: 'cc-13', title: '企业级项目中使用 Claude Code 的最佳实践', platform: 'wechat', author: '架构师之眼', publishedAt: dateTimeAgo(2, 10, 30), likes: 3400, comments: 560, shares: 1400, url: '#', summary: '总结了在团队协作、代码规范、安全审查等方面使用Claude Code的经验。' },
  { id: 'cc-14', title: 'Claude Code 搭配 GitHub Copilot，效率直接翻倍', platform: 'bilibili', author: 'CodingStartup', publishedAt: dateTimeAgo(2, 14, 0), likes: 11000, comments: 1800, shares: 4200, url: '#', summary: '演示如何同时使用两个AI工具，发挥各自优势，实现更高效的开发工作流。' },

  // 3 days ago
  { id: 'cc-15', title: 'Claude Code 帮我修好了困扰团队一周的Bug', platform: 'weibo', author: '程序猿小黑', publishedAt: dateTimeAgo(3, 11, 0), likes: 9200, comments: 1400, shares: 3800, url: '#', summary: '一个真实案例：利用Claude Code的上下文理解能力，快速定位并修复了一个隐藏很深的并发Bug。' },
  { id: 'cc-16', title: '#AI编程 用Claude Code做了个短视频自动剪辑工具', platform: 'douyin', author: '创意工坊Leo', publishedAt: dateTimeAgo(3, 20, 15), likes: 38000, comments: 4500, shares: 9800, url: '#', summary: '展示了一个使用Claude Code开发的自动化短视频剪辑工具，支持智能字幕、画面切分等功能。' },
  { id: 'cc-17', title: '作为产品经理，我是这样用 Claude Code 的', platform: 'xiaohongshu', author: 'PM小助手', publishedAt: dateTimeAgo(3, 15, 30), likes: 5100, comments: 890, shares: 1600, url: '#', summary: '产品经理视角分享如何利用Claude Code快速验证产品原型、生成需求文档和数据分析。' },

  // 4 days ago
  { id: 'cc-18', title: 'Claude Code 源码分析：它是如何理解你的项目的', platform: 'zhihu', author: 'DeepDive技术', publishedAt: dateTimeAgo(4, 9, 45), likes: 4200, comments: 780, shares: 1900, url: '#', summary: '从技术角度解析Claude Code如何通过AST分析、依赖图构建等方式理解代码库。' },
  { id: 'cc-19', title: '我用 Claude Code 开发的小程序上了热搜', platform: 'weibo', author: '互联网观察家', publishedAt: dateTimeAgo(4, 16, 0), likes: 15000, comments: 2800, shares: 6500, url: '#', summary: '一个开发者分享了使用AI辅助开发的微信小程序如何意外走红的故事。' },

  // 5 days ago
  { id: 'cc-20', title: 'Claude Code 完全免费？Anthropic 的商业策略分析', platform: 'wechat', author: 'AI商业观察', publishedAt: dateTimeAgo(5, 10, 0), likes: 6700, comments: 1100, shares: 2800, url: '#', summary: '深度分析Anthropic推出Claude Code的商业逻辑和对开发者生态的影响。' },
  { id: 'cc-21', title: '不会编程也能做App？Claude Code实测', platform: 'bilibili', author: '零基础学编程', publishedAt: dateTimeAgo(5, 14, 30), likes: 28000, comments: 4200, shares: 8900, url: '#', summary: '一个完全零基础的用户尝试用Claude Code开发一个Todo应用的全过程记录。' },

  // 6 days ago
  { id: 'cc-22', title: 'Claude Code 对比 Windsurf Copilot，谁更适合你？', platform: 'twitter', author: 'DevToolsWeekly', publishedAt: dateTimeAgo(6, 11, 30), likes: 7800, comments: 1300, shares: 3400, url: '#', summary: '从不同使用场景出发，对比Claude Code和Windsurf Copilot的优劣。' },
  { id: 'cc-23', title: '大厂程序员的新工作流：Claude Code + 飞书', platform: 'xiaohongshu', author: '大厂日记', publishedAt: dateTimeAgo(6, 17, 0), likes: 4300, comments: 670, shares: 1200, url: '#', summary: '分享在大厂中如何将Claude Code与飞书项目管理结合的团队协作经验。' },
];

const claudeCodeReports: DailyReport[] = [
  {
    date: daysAgo(0),
    summary: '今日热点集中在 Claude Code 的 MCP 协议更新和实际项目应用案例，用户对 AI 辅助全栈开发的关注度持续攀升。',
    hotTopics: ['MCP协议更新', 'AI全栈开发', 'Claude Code vs Cursor对比', '独立开发者生态'],
    contentAnalyzed: 5,
    topicSuggestions: [
      {
        id: 'ts-1', title: 'Claude Code MCP 协议深度解析与实战教程', score: 95,
        description: '制作一期关于 MCP 协议的深度内容，从原理到实战案例全覆盖。',
        whyDoThis: '今日Anthropic发布MCP更新引爆讨论，Twitter原帖8400+赞，目前中文区缺乏深度解析内容，存在明显的内容空白。',
        growthPotential: '预计搜索量将在未来一周内达到峰值，先发优势明显。MCP是Claude Code与其他工具拉开差距的关键特性，长期搜索价值高。',
        relatedContents: ['cc-1'],
      },
      {
        id: 'ts-2', title: '零基础到全栈：Claude Code 7天挑战赛', score: 88,
        description: '策划一个7天系列内容，记录零基础用户使用 Claude Code 从零开始完成一个完整项目的过程。',
        whyDoThis: '"不会编程也能做App"类内容持续获得高互动（抖音4.5万赞、B站2.8万赞），说明"AI降低编程门槛"是目前最大的内容增长点。',
        growthPotential: '系列内容具有强粘性和连续传播效应。该话题覆盖泛科技、教育、创业等多个圈层，潜在受众远大于纯技术人群。',
        relatedContents: ['cc-5', 'cc-9', 'cc-21'],
      },
      {
        id: 'ts-3', title: 'AI编程工具2026年度横评：Claude Code / Cursor / Windsurf', score: 82,
        description: '制作一份全面的AI编程工具对比报告，覆盖功能、性能、价格、生态等维度。',
        whyDoThis: '对比类内容在知乎（3200赞）和Twitter（7800赞）持续获得高关注，用户在选择工具时有强烈的对比需求。',
        growthPotential: '常青内容，每次有新工具更新都可以追加更新，具有长期SEO价值。',
        relatedContents: ['cc-3', 'cc-22'],
      },
      {
        id: 'ts-4', title: '产品经理/设计师的 Claude Code 使用指南', score: 76,
        description: '面向非技术岗位，介绍如何利用 Claude Code 提升工作效率的实用指南。',
        whyDoThis: '产品经理（小红书5100赞）和设计师群体开始关注AI编程工具，但目前内容多面向开发者，非技术人群缺少入门引导。',
        growthPotential: '差异化定位，竞争较少。可延展到运营、市场等更多非技术岗位，形成系列。',
        relatedContents: ['cc-17', 'cc-4'],
      },
    ],
  },
  {
    date: daysAgo(1),
    summary: '昨日讨论焦点是 Claude Code 的 Agent 模式能力及其在独立开发中的应用，"10分钟上线SaaS"成为热门话题。',
    hotTopics: ['Agent模式', '独立开发者', 'SaaS快速部署', '非程序员使用AI编程'],
    contentAnalyzed: 5,
    topicSuggestions: [
      {
        id: 'ts-5', title: 'Claude Code Agent 模式实战：从需求到上线全自动化', score: 91,
        description: '展示 Agent 模式在真实项目中的完整工作流。',
        whyDoThis: '技术胖的Agent模式测评获得2.3万赞，说明用户对"AI自主完成项目"概念非常感兴趣。',
        growthPotential: 'Agent是AI编程的下一个范式转变，该话题在未来几个月将持续升温。',
        relatedContents: ['cc-6'],
      },
      {
        id: 'ts-6', title: '独立开发者月入过万的AI工具栈', score: 85,
        description: '分享独立开发者使用Claude Code等AI工具提升收入的完整方法论。',
        whyDoThis: 'levelsio的"10分钟上线SaaS"推文获1.2万赞，独立开发者社区对AI提效话题极度关注。',
        growthPotential: '结合创业/副业话题，可以触达更广泛的受众，不仅限于技术人群。',
        relatedContents: ['cc-7', 'cc-8'],
      },
      {
        id: 'ts-7', title: '不会代码的博主如何用AI做自己的App', score: 79,
        description: '针对非技术博主和创作者，提供AI辅助开发的入门教程。',
        whyDoThis: '数码少女Lily的测评获8900赞，非技术用户的AI编程需求正在爆发。',
        growthPotential: '泛人群话题，适合短视频和图文多平台分发。',
        relatedContents: ['cc-9'],
      },
    ],
  },
  {
    date: daysAgo(2),
    summary: '前天热点围绕 AI 代码质量讨论和企业级应用实践，"AI写的代码比高级工程师好"引发广泛争论。',
    hotTopics: ['AI代码质量', '企业级实践', 'AI工具组合', '技术入门教程'],
    contentAnalyzed: 4,
    topicSuggestions: [
      {
        id: 'ts-8', title: 'AI代码质量深度测评：哪些场景AI写得比人好？', score: 87,
        description: '客观测评AI在不同编程场景下的代码质量。',
        whyDoThis: '"AI代码比高级工程师好"的视频获6.7万赞但争议极大，制作客观评测内容可以获得双方用户关注。',
        growthPotential: '争议性话题天然具有传播力，同时深度内容可以建立专业形象。',
        relatedContents: ['cc-12'],
      },
      {
        id: 'ts-9', title: '企业如何安全地引入 Claude Code', score: 80,
        description: '从安全合规、代码审查、团队协作等角度给出企业使用建议。',
        whyDoThis: '企业级实践内容在微信公众号获得3400赞，B2B受众质量高、变现价值大。',
        growthPotential: '面向决策者人群，虽然量不大但转化率高，适合深度内容。',
        relatedContents: ['cc-13'],
      },
    ],
  },
  {
    date: daysAgo(3),
    summary: '三天前的讨论集中在 Claude Code 的创意应用和非典型使用场景，短视频剪辑工具案例引发关注。',
    hotTopics: ['创意应用', '自动化工具', '产品经理视角', 'Bug修复案例'],
    contentAnalyzed: 3,
    topicSuggestions: [
      {
        id: 'ts-10', title: 'Claude Code 创意项目合集：这些脑洞大开的应用', score: 83,
        description: '收集整理用户使用 Claude Code 开发的创意项目。',
        whyDoThis: '短视频剪辑工具视频获3.8万赞，创意应用类内容传播性极强。',
        growthPotential: '可做成周更系列，持续产出。',
        relatedContents: ['cc-16'],
      },
    ],
  },
  {
    date: daysAgo(4),
    summary: '四天前以技术深度内容和商业分析为主，Claude Code的技术原理和商业价值成为讨论焦点。',
    hotTopics: ['技术原理', '商业策略', '微信小程序', '大厂工作流'],
    contentAnalyzed: 2,
    topicSuggestions: [
      {
        id: 'ts-11', title: 'Claude Code 技术揭秘系列：它是如何理解你的代码的', score: 78,
        description: '以通俗语言解析Claude Code的核心技术原理。',
        whyDoThis: '技术深度内容在知乎获得4200赞，说明技术人群对底层原理有需求。',
        growthPotential: '技术深度内容竞争少，SEO价值高，可建立技术权威形象。',
        relatedContents: ['cc-18'],
      },
    ],
  },
];

// ===== Category 2: Vibecoding 选题监控 =====
const vibecodingContents: ContentItem[] = [
  // Today
  { id: 'vc-1', title: 'Vibecoding到底是什么？为什么所有人都在聊它', platform: 'zhihu', author: '前沿科技说', publishedAt: dateTimeAgo(0, 9, 0), likes: 5600, comments: 890, shares: 2100, url: '#', summary: '详细解释Vibecoding的概念、起源，以及为什么它被视为编程的下一个范式。' },
  { id: 'vc-2', title: '我 Vibecoding 了一个月，这是我的感受', platform: 'xiaohongshu', author: '独立开发日记', publishedAt: dateTimeAgo(0, 14, 30), likes: 7800, comments: 1200, shares: 2800, url: '#', summary: '一个开发者分享了为期一个月的Vibecoding体验，包括效率变化和开发心态转变。' },
  { id: 'vc-3', title: '#Vibecoding 用自然语言就能写程序，程序员要失业了？', platform: 'douyin', author: '科技前沿站', publishedAt: dateTimeAgo(0, 19, 0), likes: 52000, comments: 7800, shares: 14000, url: '#', summary: '讨论Vibecoding对传统编程岗位的潜在影响，引发激烈争论。' },
  { id: 'vc-4', title: 'Vibecoding实战：用自然语言写一个Chrome扩展', platform: 'bilibili', author: '前端早早聊', publishedAt: dateTimeAgo(0, 11, 0), likes: 9200, comments: 1500, shares: 3600, url: '#', summary: '从需求描述到发布上架，展示完全通过自然语言指令完成Chrome扩展开发的全过程。' },

  // 1 day ago
  { id: 'vc-5', title: 'Andrej Karpathy定义的Vibecoding，被中国开发者玩出花了', platform: 'weibo', author: '硅谷密探', publishedAt: dateTimeAgo(1, 10, 30), likes: 8900, comments: 1600, shares: 4200, url: '#', summary: '盘点中国开发者社区对Vibecoding概念的创新实践和本土化应用。' },
  { id: 'vc-6', title: 'Vibecoding vs 传统编程：效率对比实测数据', platform: 'zhihu', author: '数据说话', publishedAt: dateTimeAgo(1, 15, 0), likes: 4300, comments: 780, shares: 1800, url: '#', summary: '用真实数据对比相同项目在Vibecoding和传统编程方式下的开发时间和代码质量。' },
  { id: 'vc-7', title: '这位老奶奶用Vibecoding做了个家族相册App', platform: 'xiaohongshu', author: '暖心故事会', publishedAt: dateTimeAgo(1, 18, 0), likes: 32000, comments: 5600, shares: 11000, url: '#', summary: '一位68岁的退休教师使用AI辅助编程为家人制作了一个精美的家族相册App。' },

  // 2 days ago
  { id: 'vc-8', title: 'Vibecoding最佳实践：如何写出好的Prompt来写代码', platform: 'wechat', author: 'Prompt工程师', publishedAt: dateTimeAgo(2, 9, 30), likes: 6700, comments: 980, shares: 2900, url: '#', summary: '总结了Vibecoding中有效的Prompt编写技巧和模式。' },
  { id: 'vc-9', title: '公司让我们全员Vibecoding，这合理吗？', platform: 'weibo', author: '职场吐槽大会', publishedAt: dateTimeAgo(2, 12, 0), likes: 11000, comments: 3400, shares: 5600, url: '#', summary: '某公司强推Vibecoding引发员工讨论，探讨AI编程在企业中的合理应用边界。' },
  { id: 'vc-10', title: '用Vibecoding做了10个项目后的深度反思', platform: 'bilibili', author: '代码哲学', publishedAt: dateTimeAgo(2, 16, 30), likes: 14000, comments: 2100, shares: 5200, url: '#', summary: '一位资深开发者使用Vibecoding完成10个不同类型项目后的系统性总结。' },

  // 3 days ago
  { id: 'vc-11', title: 'Vibecoding的边界在哪里？这些场景不适合', platform: 'zhihu', author: '技术深水区', publishedAt: dateTimeAgo(3, 10, 0), likes: 3800, comments: 670, shares: 1400, url: '#', summary: '分析Vibecoding在高并发系统、安全关键系统等场景下的局限性。' },
  { id: 'vc-12', title: '#vibecoding 做了个AI女朋友聊天App，数据炸了', platform: 'douyin', author: '极客创造家', publishedAt: dateTimeAgo(3, 21, 0), likes: 78000, comments: 12000, shares: 23000, url: '#', summary: '使用Vibecoding快速开发的AI聊天应用获得了意外的大量用户。' },

  // 4 days ago
  { id: 'vc-13', title: 'Vibecoding 教育革命：编程课应该怎么教？', platform: 'wechat', author: '教育创新社', publishedAt: dateTimeAgo(4, 8, 0), likes: 3200, comments: 560, shares: 1100, url: '#', summary: '讨论Vibecoding对编程教育的影响，以及编程课程应如何适应AI时代。' },
  { id: 'vc-14', title: '当设计师学会了Vibecoding...', platform: 'xiaohongshu', author: 'UI设计师Anna', publishedAt: dateTimeAgo(4, 13, 45), likes: 9500, comments: 1800, shares: 3600, url: '#', summary: '一位UI设计师展示了使用Vibecoding将设计稿直接转化为可运行代码的工作流。' },

  // 5 days ago
  { id: 'vc-15', title: 'Y Combinator 2026 S1：80%的项目使用了Vibecoding', platform: 'twitter', author: 'YCombinator', publishedAt: dateTimeAgo(5, 16, 0), likes: 15000, comments: 2800, shares: 7200, url: '#', summary: 'YC最新一期孵化项目中，绝大多数团队采用了Vibecoding的开发方式。' },
  { id: 'vc-16', title: 'Vibecoding 会导致代码质量下降吗？大规模研究报告', platform: 'zhihu', author: '学术前沿', publishedAt: dateTimeAgo(5, 10, 30), likes: 5400, comments: 890, shares: 2300, url: '#', summary: '一项针对1000个Vibecoding项目的研究显示了代码质量方面的有趣发现。' },

  // 6 days ago
  { id: 'vc-17', title: '我用Vibecoding一天赚了5000块', platform: 'douyin', author: '副业达人小杨', publishedAt: dateTimeAgo(6, 20, 0), likes: 95000, comments: 15000, shares: 28000, url: '#', summary: '展示了使用Vibecoding快速开发小工具并通过出售获得收入的过程。' },
  { id: 'vc-18', title: 'Vibecoding 工具链推荐：2026年最佳组合', platform: 'bilibili', author: '工具控', publishedAt: dateTimeAgo(6, 14, 0), likes: 8700, comments: 1300, shares: 3500, url: '#', summary: '推荐了2026年最适合Vibecoding的工具组合和工作流配置。' },
];

const vibecodingReports: DailyReport[] = [
  {
    date: daysAgo(0),
    summary: '今日Vibecoding讨论热度持续走高，"程序员失业"话题在抖音引发大规模讨论，Chrome扩展实战教程获得高关注。',
    hotTopics: ['Vibecoding概念普及', '程序员职业影响', '实战教程', 'Chrome扩展开发'],
    contentAnalyzed: 4,
    topicSuggestions: [
      {
        id: 'vts-1', title: 'Vibecoding 完全指南：从概念到实践', score: 93,
        description: '制作一份面向所有人的Vibecoding入门完全指南。',
        whyDoThis: '知乎"什么是Vibecoding"获5600赞，说明大量用户仍处于认知阶段，入门级内容有巨大需求。',
        growthPotential: '概念普及类内容生命周期长，可持续获得搜索流量。',
        relatedContents: ['vc-1'],
      },
      {
        id: 'vts-2', title: 'Vibecoding 不会让程序员失业，但会让编程民主化', score: 88,
        description: '以理性视角分析Vibecoding对程序员职业的真实影响。',
        whyDoThis: '"程序员失业"视频5.2万赞但评论区争论激烈，理性分析内容可以获得两方用户认同。',
        growthPotential: '争议性话题+理性分析的组合，既有传播力又能建立专业形象。',
        relatedContents: ['vc-3'],
      },
      {
        id: 'vts-3', title: '10个Vibecoding实战项目Idea，手把手带你做', score: 84,
        description: '提供10个适合Vibecoding的项目创意，并给出实践指导。',
        whyDoThis: 'Chrome扩展实战教程获9200赞，用户对可操作的实战内容需求强烈。',
        growthPotential: '每个项目都可以独立成文/视频，形成系列内容矩阵。',
        relatedContents: ['vc-4'],
      },
    ],
  },
  {
    date: daysAgo(1),
    summary: '昨日最大热点是"老奶奶做App"的感人故事（3.2万赞），说明Vibecoding的大众化叙事极具传播力。',
    hotTopics: ['大众化叙事', '中国开发者实践', '效率数据对比'],
    contentAnalyzed: 3,
    topicSuggestions: [
      {
        id: 'vts-4', title: '那些"不可能会编程的人"的Vibecoding故事', score: 90,
        description: '收集整理各种非技术背景用户使用Vibecoding的感人/有趣故事。',
        whyDoThis: '"老奶奶做App"获3.2万赞，情感共鸣+新奇感的组合传播力极强。',
        growthPotential: '人物故事类内容具有极高的转发率和跨圈层传播能力。',
        relatedContents: ['vc-7'],
      },
      {
        id: 'vts-5', title: 'Vibecoding 效率真的更高吗？数据实测告诉你', score: 82,
        description: '设计严格的对比实验，用数据说话。',
        whyDoThis: '效率对比文章获4300赞，用户需要客观数据来决定是否采用Vibecoding。',
        growthPotential: '数据驱动的内容容易被引用和传播，建立权威性。',
        relatedContents: ['vc-6'],
      },
    ],
  },
  {
    date: daysAgo(2),
    summary: '两天前的讨论集中在Vibecoding的最佳实践和企业应用争议，"全员Vibecoding"话题引发热议。',
    hotTopics: ['Prompt技巧', '企业应用', '深度反思'],
    contentAnalyzed: 3,
    topicSuggestions: [
      {
        id: 'vts-6', title: 'Vibecoding Prompt 模板库：覆盖20种常见开发场景', score: 86,
        description: '整理实用的Vibecoding Prompt模板合集。',
        whyDoThis: 'Prompt技巧文章获6700赞，实用工具类内容收藏率高。',
        growthPotential: '可持续更新的资源类内容，长期价值高。',
        relatedContents: ['vc-8'],
      },
    ],
  },
  {
    date: daysAgo(3),
    summary: '三天前讨论焦点在Vibecoding的边界和创意应用，"AI女朋友App"视频爆火。',
    hotTopics: ['Vibecoding边界', '创意应用', '爆款产品'],
    contentAnalyzed: 2,
    topicSuggestions: [
      {
        id: 'vts-7', title: 'Vibecoding 能做什么不能做什么：一份诚实的评估', score: 81,
        description: '客观分析Vibecoding的适用和不适用场景。',
        whyDoThis: '边界讨论文章获3800赞，用户需要理性指导而非盲目吹捧。',
        growthPotential: '差异化定位，在一片看好声中提供冷静分析，容易获得信任。',
        relatedContents: ['vc-11'],
      },
    ],
  },
];

// ===== Assemble categories =====
export const mockCategories: MonitorCategory[] = [
  {
    id: 'cat-1',
    name: 'Claude Code 的选题监控',
    platforms: ['douyin', 'xiaohongshu', 'weibo', 'bilibili', 'twitter', 'zhihu', 'wechat'],
    keywords: [
      { id: 'kw-1', keyword: 'Claude Code', platforms: ['douyin', 'xiaohongshu', 'weibo', 'bilibili', 'twitter', 'zhihu', 'wechat'], enabled: true },
      { id: 'kw-2', keyword: 'AI编程', platforms: ['douyin', 'xiaohongshu', 'weibo', 'bilibili', 'twitter', 'zhihu', 'wechat'], enabled: true },
      { id: 'kw-3', keyword: 'Anthropic Claude', platforms: ['twitter'], enabled: true },
      { id: 'kw-4', keyword: 'AI代码助手', platforms: ['douyin'], enabled: true },
      { id: 'kw-5', keyword: 'Claude Code教程', platforms: ['bilibili'], enabled: false },
    ],
    bloggers: [
      { id: 'bl-1', name: '技术胖', platform: 'bilibili', platformId: 'jishupang', avatar: '👨‍💻', followers: '128万', enabled: true },
      { id: 'bl-2', name: 'levelsio', platform: 'twitter', platformId: '@levelsio', avatar: '🚀', followers: '85万', enabled: true },
      { id: 'bl-3', name: 'IndieHacker周刊', platform: 'wechat', platformId: 'indiehacker-weekly', avatar: '📰', followers: '23万', enabled: true },
      { id: 'bl-4', name: '程序员小王', platform: 'bilibili', platformId: 'coder-wang', avatar: '💻', followers: '45万', enabled: true },
      { id: 'bl-5', name: 'AI工具测评师', platform: 'zhihu', platformId: 'ai-reviewer', avatar: '🔬', followers: '12万', enabled: false },
    ],
    contents: claudeCodeContents,
    reports: claudeCodeReports,
  },
  {
    id: 'cat-2',
    name: 'Vibecoding 的选题监控',
    platforms: ['douyin', 'xiaohongshu', 'weibo', 'bilibili', 'twitter', 'zhihu', 'wechat'],
    keywords: [
      { id: 'kw-6', keyword: 'Vibecoding', platforms: ['douyin', 'xiaohongshu', 'weibo', 'bilibili', 'twitter', 'zhihu', 'wechat'], enabled: true },
      { id: 'kw-7', keyword: 'Vibe Coding', platforms: ['douyin', 'xiaohongshu', 'weibo', 'bilibili', 'twitter', 'zhihu', 'wechat'], enabled: true },
      { id: 'kw-8', keyword: '自然语言编程', platforms: ['zhihu'], enabled: true },
      { id: 'kw-9', keyword: 'AI写代码', platforms: ['douyin'], enabled: true },
    ],
    bloggers: [
      { id: 'bl-6', name: 'Andrej Karpathy', platform: 'twitter', platformId: '@karpathy', avatar: '🧠', followers: '320万', enabled: true },
      { id: 'bl-7', name: '前端早早聊', platform: 'bilibili', platformId: 'frontend-early', avatar: '🎙', followers: '56万', enabled: true },
      { id: 'bl-8', name: '极客创造家', platform: 'douyin', platformId: 'geek-creator', avatar: '⚡', followers: '89万', enabled: true },
    ],
    contents: vibecodingContents,
    reports: vibecodingReports,
  },
];
