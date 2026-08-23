/**
 * 解锁流程测试脚本
 * 直接调用后端模块生成合法 unlock_token，模拟微信「阅读原文」回跳
 * 运行：node test-unlock-flow.js
 */
const { genClientId, issueUnlockToken, issueClientToken, verify } = require('./api/_utils');
const config = require('./api/config');

// 1. 模拟一个已耗尽额度的客户端
const cid = genClientId();
const exhaustedToken = issueClientToken(cid, 0);
console.log('=== 模拟额度已耗尽的客户端 ===');
console.log('client_id:', cid);
console.log('client_token (quota=0):', exhaustedToken);
console.log('校验结果:', JSON.stringify(verify(exhaustedToken)));

// 2. 签发解锁 token（模拟 /api/check 额度耗尽时返回的 unlock_token）
const unlockToken = issueUnlockToken(cid);
console.log('\n=== 签发解锁 token ===');
console.log('unlock_token:', unlockToken);
console.log('校验结果:', JSON.stringify(verify(unlockToken)));

// 3. 构造微信「阅读原文」回跳 URL
const unlockUrl = `http://localhost:3000/api/unlock?token=${encodeURIComponent(unlockToken)}`;
console.log('\n=== 模拟微信回跳 URL ===');
console.log(unlockUrl);

// 4. 预期：解锁后应生成 quota=5 的新 client_token
const expectedToken = issueClientToken(cid, config.UNLOCK_QUOTA);
console.log('\n=== 预期解锁后 ===');
console.log('新 client_token (quota=5):', expectedToken);
console.log('校验结果:', JSON.stringify(verify(expectedToken)));

console.log('\n👉 请在浏览器中打开上方 URL 验证解锁页面');
