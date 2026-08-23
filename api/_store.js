/**
 * 朱雀 AI 文本检测器 - 存储层
 * 本地开发：内存 Map（零依赖）
 * 线上部署：Upstash Redis（Vercel Marketplace 开通，环境变量自动注入）
 *
 * 用途：跨设备同步解锁状态（手机点阅读原文 → 电脑端轮询自动解锁）
 *
 * 需要的环境变量（Upstash 集成后自动注入）：
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

let memoryStore = new Map();
let upstashUrl = process.env.UPSTASH_REDIS_REST_URL || '';
let upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || '';

// 兼容旧的 Vercel KV 环境变量（如果用户还在用）
if (!upstashUrl && process.env.KV_REST_API_URL) {
  upstashUrl = process.env.KV_REST_API_URL;
  upstashToken = process.env.KV_REST_API_TOKEN || '';
}

const isRemote = !!(upstashUrl && upstashToken);

if (isRemote) {
  console.log('[store] 使用 Upstash Redis 远程存储');
} else {
  console.log('[store] 使用内存存储（本地开发模式，如需跨设备解锁请在 Vercel 开通 Upstash Redis）');
}

/** Upstash REST API 调用 */
async function upstash(command) {
  const url = `${upstashUrl.replace(/\/$/, '')}/${command}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${upstashToken}` }
  });
  const data = await resp.json();
  return data.result;
}

/** 读取键值 */
async function get(key) {
  if (isRemote) {
    try {
      const val = await upstash(`get/${encodeURIComponent(key)}`);
      return val ? JSON.parse(val) : null;
    } catch (e) { console.warn('[store] Upstash get error:', e.message); return null; }
  }
  return memoryStore.get(key) || null;
}

/** 写入键值，可选 TTL（秒） */
async function set(key, value, ttlSeconds) {
  const jsonVal = JSON.stringify(value);
  if (isRemote) {
    try {
      const cmd = ttlSeconds
        ? `set/${encodeURIComponent(key)}/${encodeURIComponent(jsonVal)}?EX=${ttlSeconds}`
        : `set/${encodeURIComponent(key)}/${encodeURIComponent(jsonVal)}`;
      await upstash(cmd);
      return;
    } catch (e) { console.warn('[store] Upstash set error:', e.message); }
  }
  memoryStore.set(key, value);
  if (ttlSeconds) {
    setTimeout(() => memoryStore.delete(key), ttlSeconds * 1000);
  }
}

/** 删除键 */
async function del(key) {
  if (isRemote) {
    try { await upstash(`del/${encodeURIComponent(key)}`); return; }
    catch (e) { console.warn('[store] Upstash del error:', e.message); }
  }
  memoryStore.delete(key);
}

/**
 * 标记某 cid 已解锁（手机端完成解锁后调用）
 * 电脑端轮询时检测到此标记即完成同步
 */
async function markUnlocked(cid, quota) {
  await set(`unlocked:${cid}`, { quota, at: Date.now() }, 3600); // 1小时有效
}

/** 检查并消费解锁标记（有则返回 quota，无则返回 null，消费后删除） */
async function consumeUnlock(cid) {
  const key = `unlocked:${cid}`;
  const data = await get(key);
  if (data) {
    await del(key);
    return data.quota;
  }
  return null;
}

module.exports = { get, set, del, markUnlocked, consumeUnlock, isRemote };
