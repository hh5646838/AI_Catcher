/**
 * 朱雀 AI 文本检测器 - 统一配置文件
 * 修改这里的字符串即可切换 API 厂商、文章库、密钥等
 */
module.exports = {
  // ========== 厂商选择 ==========
  // "deepseek" = 标准 OpenAI 格式（DeepSeek / 硅基流动 / OpenRouter 等，自动前缀缓存）
  // "doubao"   = 豆包 Context API（显式创建上下文缓存，需配置 Endpoint ID）
  AI_PROVIDER: process.env.AI_PROVIDER || "deepseek",

  // ========== 后端默认厂商配置（免费用户用的，当前设为豆包）==========
  AI_API_URL: process.env.AI_API_URL || "https://api.deepseek.com/v1/chat/completions",
  AI_API_KEY: process.env.AI_API_KEY || "",
  AI_MODEL: process.env.AI_MODEL || "deepseek-v4-flash",

  // ========== DeepSeek 独立配置（用户自带 Key 选 DeepSeek 时使用）==========
  DEEPSEEK_API_URL: process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/v1/chat/completions",
  DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",

  // ========== 豆包 Context API 配置（AI_PROVIDER=doubao 时生效）==========
  // 火山方舟控制台创建推理接入点后获得 Endpoint ID，格式如 ep-20250101xxxxx-xxxxx
  DOUBAO_BASE_URL: process.env.DOUBAO_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
  DOUBAO_API_KEY: process.env.DOUBAO_API_KEY || "",
  DOUBAO_MODEL: process.env.DOUBAO_MODEL || "",          // Endpoint ID，Context API 用
  DOUBAO_STANDARD_MODEL: process.env.DOUBAO_STANDARD_MODEL || process.env.AI_MODEL || "doubao-seed-2-0-mini-260428", // 标准接口用的模型名
  DOUBAO_CONTEXT_ID: process.env.DOUBAO_CONTEXT_ID || "", // 预创建的上下文缓存 ID，留空则自动创建并缓存
  DOUBAO_CONTEXT_TTL: parseInt(process.env.DOUBAO_CONTEXT_TTL || "3600", 10), // 缓存有效期秒

  // ========== 安全与额度 ==========
  // 生产环境务必通过环境变量 SECRET_KEY 注入，不要使用默认值
  SECRET_KEY: process.env.SECRET_KEY || "zhuque-ai-detector-default-secret-please-change",
  FREE_QUOTA: 5,               // 新访客默认免费次数
  UNLOCK_QUOTA: 5,             // 看文章解锁后增加的次数
  TOKEN_EXPIRE_DAYS: 30,       // client_token 有效期（天）
  UNLOCK_TOKEN_EXPIRE_HOURS: 24, // 解锁链接有效期（小时）

  // ========== 文本限制 ==========
  MAX_TEXT_LENGTH: 1000,       // 建议最高字数（软限制，超出会提示）

  // ========== 公众号文章库（随机抓取引流）==========
  // 替换为你自己的公众号文章地址；数量越多越不容易重复
  WECHAT_ARTICLES: [
    { title: "朱雀工具使用指南：如何精准检测 AI 生成文本", url: "https://mp.weixin.qq.com/s/your-article-1" },
    { title: "深度解析：AI 文本检测的三大核心原理", url: "https://mp.weixin.qq.com/s/your-article-2" },
    { title: "从困惑度到爆发性：教你识别机器写作的痕迹", url: "https://mp.weixin.qq.com/s/your-article-3" },
    { title: "写作者必看：如何让你的文章更像人类创作", url: "https://mp.weixin.qq.com/s/your-article-4" }
  ]
};
