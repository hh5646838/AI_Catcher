/**
 * 朱雀 AI 文本检测器 - 共享工具模块
 * 文件名以 _ 开头，Vercel 不会将其路由为 API 端点
 */
const crypto = require('crypto');
const config = require('./config');

/**
 * HMAC-SHA256 签名 token，防篡改
 * 格式：base64url(payload).base64url(signature)
 */
function sign(payload) {
  const header = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', config.SECRET_KEY)
    .update(header)
    .digest('base64url');
  return `${header}.${sig}`;
}

/**
 * 校验 token 签名与有效期，返回 payload 或 null
 */
function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [header, sig] = parts;
  const expected = crypto
    .createHmac('sha256', config.SECRET_KEY)
    .update(header)
    .digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** 生成随机客户端 ID */
function genClientId() {
  return crypto.randomBytes(12).toString('hex');
}

/** 签发 client_token（含剩余次数） */
function issueClientToken(cid, quota) {
  return sign({
    cid,
    q: quota,
    exp: Date.now() + config.TOKEN_EXPIRE_DAYS * 86400000
  });
}

/** 签发一次性解锁 token */
function issueUnlockToken(cid) {
  return sign({
    cid,
    purpose: 'unlock',
    exp: Date.now() + config.UNLOCK_TOKEN_EXPIRE_HOURS * 3600000
  });
}

/** 从文章库随机取一篇 */
function randomArticle() {
  const arr = config.WECHAT_ARTICLES;
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = {
  sign,
  verify,
  genClientId,
  issueClientToken,
  issueUnlockToken,
  randomArticle
};
