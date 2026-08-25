/**
 * 公开配置接口 - 前端启动时调用，获取额度等可公开的配置
 * 这样改 config.json 后，前端帮助弹窗/解锁弹窗的文字也会自动更新
 */
const config = require("./config");

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.statusCode = 200;
  res.end(JSON.stringify({
    free_quota: config.FREE_QUOTA,
    unlock_quota: config.UNLOCK_QUOTA,
    max_text_length: config.MAX_TEXT_LENGTH
  }));
};
