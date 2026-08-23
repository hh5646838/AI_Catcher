# 朱雀 AI 文本检测器 - 配置说明文档

## 项目结构

```
朱雀工具/
├── public/index.html    # 前端页面
├── api/
│   ├── config.js        # 统一配置（API地址/模型/文章库/密钥）
│   ├── check.js         # 核心检测接口
│   ├── unlock.js        # 微信文章解锁回调
│   └── _utils.js        # HMAC token 工具
├── dev-server.js        # 本地预览服务器
├── package.json
└── vercel.json
```

---

## 一、本地开发配置

### 方式一：环境变量（推荐）

在项目目录下打开 PowerShell，设置环境变量后启动：

```powershell
# ===== 豆包配置（当前使用）=====
$env:AI_API_URL="https://ark.cn-beijing.volces.com/api/v3/chat/completions"
$env:AI_API_KEY="你的豆包API Key"
$env:AI_MODEL="doubao-seed-2-0-mini-260428"

# 启动
node dev-server.js
```

```powershell
# ===== DeepSeek 配置（切换厂商只需改这三行）=====
$env:AI_API_URL="https://api.deepseek.com/v1/chat/completions"
$env:AI_API_KEY="你的DeepSeek API Key"
$env:AI_MODEL="deepseek-v4-flash"

# 启动
node dev-server.js
```

启动后浏览器打开 `http://localhost:3000`

### 方式二：直接改 api/config.js

如果不想每次设环境变量，直接编辑 `api/config.js` 里的默认值：

```js
AI_API_URL: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
AI_API_KEY: "你的Key",
AI_MODEL: "doubao-seed-2-0-mini-260428",
```

然后直接 `node dev-server.js` 即可。

---

## 二、API Key 获取指南

### 豆包（火山方舟）

1. 打开 [火山方舟控制台](https://console.volcengine.com/ark)
2. 左侧菜单 → **模型广场**
3. 搜索 `seed-2.0-mini`（或 lite/pro），点「开通」
4. 左侧菜单 → **API Key 管理** → 「创建 API Key」
5. 复制 Key（格式：`ark-` 开头）

**可用模型参考：**

| 模型 | 模型ID | 输入(元/M) | 输出(元/M) | 定位 |
|---|---|---|---|---|
| Doubao-Seed-2.0-mini | `doubao-seed-2-0-mini-260428` | ~0.3 | ~1.8 | 最便宜，极速 |
| Doubao-Seed-2.0-lite | `doubao-seed-2-0-lite-260428` | 0.6 | 3.6 | 均衡，推荐 |
| Doubao-Seed-2.1-pro | `doubao-seed-2-1-pro-260628` | 6 | 30 | 旗舰，贵 |

> 注意：模型ID中的日期后缀可能更新，以控制台「在线调试」页显示的为准。

### DeepSeek

1. 打开 [DeepSeek 开放平台](https://platform.deepseek.com)
2. 注册登录 → 左侧 **API Keys**
3. 「创建新的 API Key」→ 复制（格式：`sk-` 开头）

**可用模型：**

| 模型 | 模型ID | 输入缓存命中(元/M) | 输入未命中(元/M) | 输出(元/M) |
|---|---|---|---|---|
| DeepSeek-V4-Flash | `deepseek-v4-flash` | 0.05~0.10 | 1.5~3.0 | 4.5~9.0 |
| DeepSeek-V4-Pro | `deepseek-v4-pro` | 0.15~0.30 | 4.5~9.0 | 13.5~27.0 |

> 价格分高峰/空闲时段，高峰为工作日 9:00-12:00、14:00-18:00。

---

## 三、Vercel 部署配置

### 步骤

1. 将项目推送到 GitHub
2. 在 [Vercel](https://vercel.com) 导入仓库
3. 在项目设置 → **Environment Variables** 中添加：

| 变量名 | 示例值 | 说明 |
|---|---|---|
| `AI_API_URL` | `https://ark.cn-beijing.volces.com/api/v3/chat/completions` | API 端点 |
| `AI_API_KEY` | `ark-xxxx` | API 密钥 |
| `AI_MODEL` | `doubao-seed-2-0-mini-260428` | 模型名称 |
| `SECRET_KEY` | 任意随机字符串 | HMAC 签名密钥，**生产环境务必设置** |

4. 点 Deploy，等待部署完成

### 切换厂商

在 Vercel 环境变量里修改 `AI_API_URL`、`AI_API_KEY`、`AI_MODEL` 三个值，然后点 **Redeploy** 即可。

---

## 四、豆包 Context API 模式（可选，带前缀缓存）

默认走标准 `/chat/completions` 模式，零配置即可用。如果想启用豆包的前缀缓存降低成本，需要额外配置：

### 前置条件

1. 在火山方舟控制台创建**推理接入点**（Endpoint），获得 `ep-xxxxxx` 格式的 ID
2. 确保接入点绑定的模型支持前缀缓存

### 环境变量

```powershell
$env:AI_PROVIDER="doubao"
$env:DOUBAO_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
$env:DOUBAO_API_KEY="你的豆包Key"
$env:DOUBAO_MODEL="ep-你的接入点ID"          # 必须是 ep- 开头，不是模型名
$env:DOUBAO_CONTEXT_ID=""                     # 留空则自动创建，也可预创建后填入
$env:DOUBAO_CONTEXT_TTL="3600"                # 缓存有效期秒
```

### 工作原理

```
首次请求 → 自动调用 /context/create 创建上下文缓存（System Prompt）
         → 获得 context_id，缓存在服务端内存
         → 调用 /context/chat/completions 只传用户文本
         → 响应中 cached_tokens > 0 即为缓存命中

后续请求 → 直接复用 context_id，System Prompt 不再重复计费
```

Context 过期时自动重建并重试，无需人工干预。

---

## 五、完整环境变量列表

| 变量名 | 默认值 | 说明 |
|---|---|---|
| `AI_PROVIDER` | `deepseek` | 厂商模式：`deepseek`(标准兼容) 或 `doubao`(Context API) |
| `AI_API_URL` | DeepSeek 地址 | 标准模式的 API 端点 |
| `AI_API_KEY` | 空 | 标准模式的 API Key |
| `AI_MODEL` | `deepseek-v4-flash` | 标准模式的模型名 |
| `DOUBAO_BASE_URL` | 火山方舟地址 | 豆包模式的基础 URL |
| `DOUBAO_API_KEY` | 空 | 豆包模式的 API Key |
| `DOUBAO_MODEL` | 空 | 豆包模式的 Endpoint ID（ep-开头） |
| `DOUBAO_CONTEXT_ID` | 空 | 预创建的上下文缓存 ID，留空自动创建 |
| `DOUBAO_CONTEXT_TTL` | `3600` | 上下文缓存有效期（秒） |
| `SECRET_KEY` | 内置默认值 | HMAC 签名密钥，**生产务必改** |
| `FREE_QUOTA` | `5` | 新访客免费次数 |
| `UNLOCK_QUOTA` | `5` | 看文章解锁次数 |
| `MAX_TEXT_LENGTH` | `1000` | 文本字数软限制 |

---

## 六、公众号文章引流配置

编辑 `api/config.js` 中的 `WECHAT_ARTICLES` 数组：

```js
WECHAT_ARTICLES: [
  { title: "文章标题1", url: "https://mp.weixin.qq.com/s/xxx" },
  { title: "文章标题2", url: "https://mp.weixin.qq.com/s/yyy" },
]
```

用户额度耗尽时，系统随机抽取一篇展示。建议配置 3 篇以上，避免重复。

---

## 七、前端个人配置

编辑 `public/index.html` 顶部的 `window.SITE_CONFIG`：

```js
window.SITE_CONFIG = {
  SITE_TITLE: "朱雀 AI 文本检测器 - 免费精准检测",
  AVATAR_URL: "你的头像图片地址",
  FOLLOW_LINK: "点击关注跳转的链接（公众号/主页）",
  REWARD_QR_CODE: "打赏收款二维码图片地址"
};
```

改完刷新页面即生效，无需重启服务器。

---

## 八、常见问题

**Q: 切换厂商需要改代码吗？**
A: 不需要。改三个环境变量（URL/Key/Model）重启即可。代码自动兼容不支持 `response_format` 的厂商。

**Q: 自带 Key 模式安全吗？**
A: 安全。Key 仅存在浏览器内存变量中，随请求发送给后端转发，不存入 LocalStorage、不落地、不记录日志。刷新页面即清除。

**Q: 额度能被 F12 篡改吗？**
A: 不能。client_token 是 HMAC-SHA256 签名的，后端校验签名，篡改后签名不匹配会被当作新访客处理。

**Q: 豆包和 DeepSeek 哪个更划算？**
A: 短文本检测场景豆包 seed-2.0-mini 更便宜（约0.0004元/次），DeepSeek v4-flash 约0.002-0.005元/次（取决于缓存命中率和时段）。但 DeepSeek 检测准确度通常更高。

**Q: 本地预览服务器怎么停？**
A: 在运行服务器的终端按 `Ctrl+C`，或执行 `Get-Process node | Stop-Process`。
