/**
 * 朱雀 AI 文本检测器 - 自动解锁接口 GET /api/auto-unlock
 *
 * 用途：公众号文章「阅读原文」填此接口地址。
 * 用户在微信里读完文章点「阅读原文」→ 打开此接口 →
 * 读取 cookie 中的 cid → 生成 unlock_token → 302 跳转 /api/unlock?token=xxx →
 * 解锁成功，电脑端轮询自动同步额度。
 */
const { issueUnlockToken } = require('./_utils');

module.exports = (req, res) => {
  // 从 cookie 读取 cid（由 /api/read 存入）
  const cookies = req.headers.cookie || '';
  const cidMatch = cookies.match(/zhuque_cid=([^;]+)/);
  const cid = cidMatch ? cidMatch[1] : '';

  if (!cid) {
    // 没有 cid（可能直接访问，不是从扫码跳转来的）
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>解锁失败</title></head>
    <body style="display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:sans-serif;background:#fff5f5;">
    <div style="text-align:center;padding:40px;"><h1 style="color:#1a1a1a;">解锁失败</h1>
    <p style="color:#666;">请从电脑端扫码进入文章后，再点击「阅读原文」解锁。</p>
    <a href="/" style="display:inline-block;margin-top:20px;padding:12px 32px;background:#C8102E;color:#fff;text-decoration:none;border-radius:50px;">返回首页</a>
    </div></body></html>`);
  }

  // 生成 unlock_token 并跳转到解锁接口
  const token = issueUnlockToken(cid);
  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(302, { Location: '/api/unlock?token=' + encodeURIComponent(token) });
  res.end();
};
