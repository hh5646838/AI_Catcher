/**
 * 朱雀 AI 文本检测器 - 解锁状态轮询接口 GET /api/status?cid=xxx
 *
 * 用途：电脑端弹窗轮询，检测用户是否已在手机端完成解锁
 * 手机端点阅读原文 → /api/unlock 更新存储 → 电脑端轮询到 → 自动解锁
 */
const { verify, issueClientToken } = require('./_utils');
const { consumeUnlock } = require('./_store');

module.exports = async (req, res) => {
  const { cid } = req.query || {};
  if (!cid || typeof cid !== 'string') {
    return res.status(400).json({ error: '缺少 cid 参数' });
  }

  // 检查是否有解锁标记
  const quota = await consumeUnlock(cid);

  if (quota != null) {
    // 已解锁，签发新的 client_token
    const clientToken = issueClientToken(cid, quota);
    return res.status(200).json({
      unlocked: true,
      quota,
      client_token: clientToken
    });
  }

  return res.status(200).json({ unlocked: false });
};
