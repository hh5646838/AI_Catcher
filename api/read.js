/**
 * 朱雀 AI 文本检测器 - 文章跳转中间页 GET /api/read?cid=xxx&url=xxx
 *
 * 用途：电脑端弹窗的二维码指向此接口，手机扫码后：
 *   1. 把 cid 存入手机浏览器 cookie（1小时有效）
 *   2. 302 跳转到公众号文章 URL
 * 这样用户在微信里读完文章点「阅读原文」回到 /api/auto-unlock 时，
 * 能通过 cookie 识别出对应的电脑端用户，实现跨设备解锁。
 */
const config = require('./config');

module.exports = (req, res) => {
  const { cid, url } = req.query || {};

  // 没有 cid 或文章 URL，直接跳首页
  if (!cid || !url) {
    res.writeHead(302, { Location: '/' });
    return res.end();
  }

  // 校验 URL 必须是 http(s) 开头，防止开放重定向
  if (!/^https?:\/\//i.test(url)) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('无效的文章链接');
  }

  // cid 存入 cookie（1小时，httponly，同站）
  res.setHeader('Set-Cookie', `zhuque_cid=${cid}; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax`);
  res.setHeader('Cache-Control', 'no-store');

  // 302 跳转到公众号文章
  res.writeHead(302, { Location: url });
  res.end();
};
