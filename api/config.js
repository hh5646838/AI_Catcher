/**
 * 朱雀 AI 文本检测器 - 统一配置文件
 * 运营配置（额度/文章库/帮助文字）在 runtime.json，后期只改 JSON 不用动代码
 * API/密钥等敏感配置通过环境变量注入
 */
const fs = require("fs");
const path = require("path");

let runtime = {};
try {
  runtime = JSON.parse(fs.readFileSync(path.join(__dirname, "runtime.json"), "utf8"));
} catch (e) {
  console.warn("[config] 读取 config.json 失败，使用默认值", e.message);
}

module.exports = {
  // ========== 厂商选择 ==========
  AI_PROVIDER: process.env.AI_PROVIDER || "deepseek",

  // ========== 后端默认厂商配置（免费用户用的）==========
  AI_API_URL: process.env.AI_API_URL || "https://api.deepseek.com/v1/chat/completions",
  AI_API_KEY: process.env.AI_API_KEY || "",
  AI_MODEL: process.env.AI_MODEL || "deepseek-v4-flash",

  // ========== DeepSeek 独立配置（用户自带 Key 选 DeepSeek 时使用）==========
  DEEPSEEK_API_URL: process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/v1/chat/completions",
  DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",

  // ========== 豆包 Context API 配置 ==========
  DOUBAO_BASE_URL: process.env.DOUBAO_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
  DOUBAO_API_KEY: process.env.DOUBAO_API_KEY || "",
  DOUBAO_MODEL: process.env.DOUBAO_MODEL || "",
  DOUBAO_STANDARD_MODEL: process.env.DOUBAO_STANDARD_MODEL || process.env.AI_MODEL || "doubao-seed-2-0-mini-260428",
  DOUBAO_CONTEXT_ID: process.env.DOUBAO_CONTEXT_ID || "",
  DOUBAO_CONTEXT_TTL: parseInt(process.env.DOUBAO_CONTEXT_TTL || "3600", 10),

  // ========== 安全与额度（从 config.json 读取，默认值兜底）==========
  SECRET_KEY: process.env.SECRET_KEY || "zhuque-ai-detector-default-secret-please-change",
  FREE_QUOTA: runtime.free_quota ?? 9,
  UNLOCK_QUOTA: runtime.unlock_quota ?? 3,
  TOKEN_EXPIRE_DAYS: runtime.token_expire_days ?? 30,
  UNLOCK_TOKEN_EXPIRE_HOURS: runtime.unlock_token_expire_hours ?? 24,
  MAX_TEXT_LENGTH: runtime.max_text_length ?? 1000,

  // ========== 公众号文章库（从 config.json 读取）==========
  WECHAT_ARTICLES: runtime.wechat_articles || [
    { title: "朱雀工具使用指南", url: "https://mp.weixin.qq.com/s/your-article-1" }
  ],

  // ========== 帮助弹窗文字（从 config.json 读取，支持 {free_quota}/{unlock_quota} 占位符）==========
  HELP_ITEMS: runtime.help_items || []
};
