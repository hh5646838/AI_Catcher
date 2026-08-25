# 朱雀 AI 文本检测器

极简现代化的 AI 生成文本检测工具，支持逐句高亮标注、免费额度+公众号文章解锁、自带 API Key 双厂商模式、跨设备解锁同步。

## 功能特性

- **AI 文本检测**：从困惑度、爆发性、句式模式三维度分析，输出 AI 生成概率
- **逐句高亮标注**：红色=绝对AI生成（≥70%），黄色=建议修改（55-70%），点击句子查看详情
- **双模式使用**：免费额度（看文章解锁）+ 自带 API Key（无限检测，密钥仅存内存不落地）
- **跨设备解锁同步**：手机扫码读文章点「阅读原文」，电脑端自动到账
- **双厂商支持**：豆包（火山方舟）/ DeepSeek，前端可切换
- **防刷机制**：HMAC 签名 token，后端校验，F12 改不了次数
- **零依赖**：纯 Node.js，Vercel Serverless Functions 直接部署

## 项目结构

```
朱雀工具/
├── public/
│   └── index.html          # 前端单页（导航/检测/高亮/弹窗/解锁轮询）
├── api/
│   ├── config.js           # 配置加载（环境变量 + runtime.json）
│   ├── runtime.json        # 运营配置（额度/文章库/帮助文字）← 后期主要改这个
│   ├── check.js            # 核心检测接口
│   ├── unlock.js           # 微信解锁回调
│   ├── auto-unlock.js      # 自动解锁（读 cookie 生成 token）
│   ├── read.js             # 文章跳转中间页（存 cid 到 cookie）
│   ├── status.js           # 解锁状态轮询接口
│   ├── settings.js         # 公开配置接口（前端启动时调用）
│   ├── _utils.js           # HMAC token 签发校验 + 随机文章
│   └── _store.js           # 存储层（本地内存 + Upstash Redis 自动切换）
├── dev-server.js           # 本地预览服务器
├── package.json
├── vercel.json
└── README.md
```

## 快速开始（本地开发）

### 1. 配置环境变量

在项目目录下打开 PowerShell：

```powershell
# 豆包（当前推荐，便宜）
$env:AI_API_URL="https://ark.cn-beijing.volces.com/api/v3/chat/completions"
$env:AI_API_KEY="你的豆包API Key（ark-开头）"
$env:AI_MODEL="doubao-seed-2-0-mini-260428"
$env:SECRET_KEY="任意随机字符串"

# 启动
node dev-server.js
```

浏览器打开 `http://localhost:3000`

### 2. 切换 DeepSeek

```powershell
$env:AI_API_URL="https://api.deepseek.com/v1/chat/completions"
$env:AI_API_KEY="你的DeepSeek Key（sk-开头）"
$env:AI_MODEL="deepseek-v4-flash"
node dev-server.js
```

## 部署到 Vercel

### 前置准备

1. 将项目推送到 GitHub 仓库
2. 在 [Vercel](https://vercel.com) 导入仓库

### 重要：项目设置

- **Root Directory**：留空或 `./`（**不要设成 public**，否则 api 目录会被忽略）
- **Framework Preset**：Other
- **Build Command / Output Directory**：保持默认（不要开 Override）

### 环境变量

在 Vercel 项目 → Settings → Environment Variables 添加：

| 变量名 | 示例值 | 说明 |
|---|---|---|
| `AI_API_URL` | `https://ark.cn-beijing.volces.com/api/v3/chat/completions` | API 端点 |
| `AI_API_KEY` | `ark-xxxx` | API 密钥 |
| `AI_MODEL` | `doubao-seed-2-0-mini-260428` | 模型名称 |
| `SECRET_KEY` | 任意随机字符串 | HMAC 签名密钥，**生产环境务必设置** |

### Upstash Redis（跨设备解锁必需）

1. Vercel 项目 → **Integrations** → 添加 **Upstash Redis**
2. 创建数据库（免费版够用），连接到当前项目
3. 环境变量自动注入（`UPSTASH_KV_REST_API_URL` / `UPSTASH_KV_REST_API_TOKEN` 等）
4. `_store.js` 自动识别并使用，无需额外配置

> 不配置 Upstash 也能运行，解锁状态存在服务端内存，但 Vercel Serverless 冷启动后会丢失，跨设备同步不可靠。**生产环境建议配置 Upstash。**

### 部署

点 Deploy，等待完成。部署后访问 `https://你的项目.vercel.app`。

## 运营配置（runtime.json）

后期维护**只改这个文件**，不用动代码：

```json
{
  "free_quota": 9,
  "unlock_quota": 3,
  "max_text_length": 1000,
  "help_items": [
    "每位新访客默认赠送 <strong>{free_quota} 次</strong>免费检测额度。",
    "额度用完后，阅读推荐的公众号文章并点击文末「阅读原文」即可自动解锁 <strong>+{unlock_quota} 次</strong>。",
    "也可展开「自带 API Key」，填入自己的 API Key 即可<strong>无限检测</strong>，密钥仅存内存不落地。",
    "检测结果从困惑度、爆发性、词汇句式三个维度综合判断，仅供参考。"
  ],
  "wechat_articles": [
    { "title": "文章标题", "url": "https://mp.weixin.qq.com/s/xxx" }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `free_quota` | 新访客默认免费次数 |
| `unlock_quota` | 每次看文章解锁增加的次数 |
| `max_text_length` | 文本字数软限制 |
| `help_items` | 帮助弹窗文字，支持 `{free_quota}`/`{unlock_quota}` 占位符和 HTML 标签 |
| `wechat_articles` | 公众号文章库，额度耗尽时随机展示一篇 |

改完 push 到 GitHub，Vercel 自动重新部署，前端帮助弹窗文字自动更新。

## 前端个人配置（index.html 顶部）

```js
window.SITE_CONFIG = {
  SITE_TITLE: "朱雀 AI 文本检测器 - 免费精准检测",
  AVATAR_URL: "头像图片地址",
  FOLLOW_LINK: "关注跳转链接（公众号/主页）",
  REWARD_QR_CODE: "打赏二维码地址",
  MORE_TOOLS_LINK: "更多工具跳转链接",
  MORE_TOOLS_TEXT: "更多工具"
};
```

改完刷新即生效，无需重启。

## 公众号文章解锁配置

1. 在 `runtime.json` 的 `wechat_articles` 里填入你的公众号文章
2. 每篇用于解锁的公众号文章，底部「阅读原文」链接填：
   ```
   https://你的域名/api/auto-unlock
   ```
3. 用户流程：次数用完 → 弹窗扫码 → 手机读文章 → 点「阅读原文」→ 自动解锁 → 电脑端到账

## API 接口

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/check` | POST | 文本检测，body: `{ text, client_token, api_key?, provider? }` |
| `/api/unlock` | GET | 解锁回调，参数 `?token=xxx`，返回成功/失败 HTML 页 |
| `/api/auto-unlock` | GET | 自动解锁（读 cookie cid 生成 token 跳转 /api/unlock） |
| `/api/read` | GET | 文章跳转中间页，参数 `?cid=xxx&url=xxx`，存 cookie 后 302 跳转 |
| `/api/status` | GET | 解锁状态轮询，参数 `?cid=xxx`，返回 `{ unlocked: true/false, quota: n }` |
| `/api/settings` | GET | 公开配置，返回额度、帮助文字等 |

## 额度与防刷机制

- **client_token**：HMAC-SHA256 签名，包含 `cid`（客户端ID）、`quota`（剩余次数）、`exp`（过期时间）
- 每次检测后端校验签名 → 扣次数 → 重新签发 token 返回
- F12 改 localStorage 里的数字无效，签名不匹配直接拒绝
- **当前无每日重置**：次数用完需看文章解锁，解锁后次数累积

### 如需加每日重置

在 token 中增加 `date` 字段，后端校验时若日期变化则自动重置 quota 为 `free_quota`。

## 豆包 Context API 模式（可选，降本）

默认走标准 `/chat/completions` 模式。如需启用豆包前缀缓存：

```powershell
$env:AI_PROVIDER="doubao"
$env:DOUBAO_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
$env:DOUBAO_API_KEY="你的豆包Key"
$env:DOUBAO_MODEL="ep-你的推理接入点ID"   # ep-开头，不是模型名
```

System Prompt 自动创建上下文缓存，后续请求复用，降低输入成本。

## 常见问题

**Q: 部署后 /api/check 返回 404？**
A: 检查 Vercel 项目设置 → Root Directory 是否设成了 `public`，改成空或 `./` 后重新部署。

**Q: 手机端点「阅读原文」后电脑端没到账？**
A: 确认配置了 Upstash Redis（免费版即可），不配置时解锁状态存在 Serverless 内存，冷启动后丢失。

**Q: 自带 Key 模式支持哪些厂商？**
A: 前端可选豆包或 DeepSeek，都是 OpenAI 兼容格式。其他兼容厂商（硅基流动、OpenRouter 等）可在 `config.js` 里添加。

**Q: 本地服务器怎么停？**
A: 终端按 `Ctrl+C`，或执行 `Get-Process node | Stop-Process`。

**Q: 高亮句子手机端看不到详情？**
A: 点击高亮句子即可弹出详情，桌面端 hover 也能看。
