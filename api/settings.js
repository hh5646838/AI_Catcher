/**
 * 公开配置接口 - 前端启动时调用，获取额度、帮助文字等可公开的配置
 * 改 config.json 后，前端帮助弹窗/解锁弹窗文字自动更新
 */
const config = require("./config");

module.exports = async (req, res) => {
  // 替换帮助文字中的占位符
  const helpItems = (config.HELP_ITEMS || []).map(item =>
    item
      .replace(/\{free_quota\}/g, config.FREE_QUOTA)
      .replace(/\{unlock_quota\}/g, config.UNLOCK_QUOTA)
  );

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.statusCode = 200;
  res.end(JSON.stringify({
    free_quota: config.FREE_QUOTA,
    unlock_quota: config.UNLOCK_QUOTA,
    max_text_length: config.MAX_TEXT_LENGTH,
    help_items: helpItems
  }));
};
