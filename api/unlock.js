/**
 * 朱雀 AI 文本检测器 - 微信文章解锁回调 GET /api/unlock?token=xxx
 *
 * 流程：
 *  1. 用户额度耗尽 → 前端弹窗展示随机公众号文章
 *  2. 用户阅读文章后点击文末「阅读原文」跳回本接口
 *  3. 后端校验 unlock_token，自动为该设备 +N 次检测次数
 *  4. 返回漂亮的成功提示页，自动写回 client_token 并跳转首页
 */
const config = require('./config');
const { verify, issueClientToken } = require('./_utils');
const { markUnlocked } = require('./_store');

module.exports = async (req, res) => {
  const { token } = req.query || {};
  const payload = verify(token);

  const success = !!(payload && payload.purpose === 'unlock' && payload.cid);
  let clientToken = '';
  if (success) {
    clientToken = issueClientToken(payload.cid, config.UNLOCK_QUOTA);
    // 在存储中标记已解锁，供电脑端轮询同步（跨设备解锁的关键）
    await markUnlocked(payload.cid, config.UNLOCK_QUOTA);
  }

  const html = buildPage(success, clientToken, config.UNLOCK_QUOTA);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(html);
};

function buildPage(success, clientToken, quota) {
  const title = success ? '解锁成功' : '解锁失败';
  const emoji = success ? '🎉' : '⚠️';
  const msg = success
    ? `已为你增加 ${quota} 次免费检测额度`
    : '链接无效或已过期，请返回检测页重新获取解锁链接';

  // 成功时通过 JS 自动写回 client_token 到 localStorage（同源共享）
  const autoScript = success
    ? `<script>
try { localStorage.setItem('zhuque_client_token', '${clientToken}'); } catch(e){}
setTimeout(function(){ window.location.href = '/'; }, 2500);
</script>`
    : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} - 朱雀 AI 文本检测器</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    background: linear-gradient(135deg, #fff5f5 0%, #fff 50%, #fff0f0 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .card {
    background: #fff;
    border-radius: 20px;
    padding: 48px 40px;
    text-align: center;
    box-shadow: 0 10px 40px rgba(200, 16, 46, 0.12);
    max-width: 420px;
    width: 100%;
    border: 1px solid rgba(200, 16, 46, 0.08);
  }
  .icon { font-size: 64px; margin-bottom: 20px; }
  h1 { font-size: 26px; color: #1a1a1a; margin-bottom: 12px; font-weight: 700; }
  p { font-size: 15px; color: #666; line-height: 1.7; margin-bottom: 28px; }
  .btn {
    display: inline-block;
    background: linear-gradient(135deg, #C8102E, #E63946);
    color: #fff;
    text-decoration: none;
    padding: 14px 36px;
    border-radius: 50px;
    font-size: 15px;
    font-weight: 600;
    transition: transform .2s, box-shadow .2s;
    box-shadow: 0 4px 16px rgba(200, 16, 46, 0.3);
  }
  .btn:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(200, 16, 46, 0.4); }
  .tip { margin-top: 20px; font-size: 13px; color: #999; }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">${emoji}</div>
    <h1>${title}</h1>
    <p>${msg}</p>
    <a href="/" class="btn">返回检测</a>
    ${success ? '<p class="tip">页面将在 2.5 秒后自动跳转…</p>' : ''}
  </div>
  ${autoScript}
</body>
</html>`;
}
