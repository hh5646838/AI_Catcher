/**
 * 朱雀 AI 文本检测器 - 核心检测接口 POST /api/check
 *
 * 功能：
 *  1. 校验 client_token 与剩余次数（自带 Key 模式跳过额度）
 *  2. 调用大模型 API，支持双厂商：
 *     - deepseek：标准 OpenAI 格式，System Prompt 静态化触发自动前缀缓存
 *     - doubao：  Context API，显式创建上下文缓存 + context_id 复用
 *  3. 用户自带 Key 仅内存透传，绝不落地
 *  4. 额度耗尽时返回随机公众号文章 + 解锁 token
 */
const config = require('./config');
const {
  verify,
  genClientId,
  issueClientToken,
  issueUnlockToken,
  randomArticle
} = require('./_utils');

/**
 * 绝对静态 System Prompt —— 不得加入任何动态参数（时间戳、随机数、用户ID等）
 * - DeepSeek：触发磁盘前缀缓存，降低约 30 倍输入成本
 * - 豆包：  作为 Context API 的缓存内容，创建一次后复用
 */
const SYSTEM_PROMPT =
  '你是一名资深 AIGC 中文文本检测专家。你的核心使命是准确识别文本是由 AI 生成还是人类撰写，重点防止"将规范人类文本错判为 AI"以及"漏检带有伪装倾向的新型 AI 文本"。' +
  '### 核心判定哲学：【有我】vs【无我】' +
  '* 人类写作本质（有我）：存在独特主观视角、真实体验、鲜明立场偏好、非标准表达、思维跳跃、情绪起伏、语法瑕疵或口语化断句。' +
  '* AI 写作本质（无我）：客观中立、条理过度清晰、信息均匀堆砌、逻辑无缝推进、结构高度平滑、缺乏真实生活个体的体验与立场。' +
  '### 第一阶段：逐句扫描与规则判定' +
  '#### 1. 绝对保护规则（识别到以下任一特征，判定为人类写作，置信度低于35%，直接忽略，绝不纳入怀疑列表）：' +
  '* 朴素平直/不修饰的日常表达、明确的个人情绪或立场偏好；' +
  '* 错别字、非标准语法、倒装句、断句跳跃、口语化停顿；' +
  '* 反讽、暗讽、网络梗词、中英文混用、地方方言；' +
  '* 真正的废话、跑题、无逻辑关联的思维跳跃。' +
  '#### 2. AI 信号捕获（当以下特征叠加出现时，判定为可疑，信号越多概率越高）：' +
  '* 信号A（过度结构化）：分点罗列、频繁使用"首先/其次/综上所述/总而言之/一方面...另一方面"；' +
  '* 信号B（空洞宏大表述）：出现"深刻地改变""前所未有的""重要力量""深远影响""极大地推动"等无具体所指的拔高词汇；' +
  '* 信号C（句式匀称度）：句子长度异常相近，结构高度对称，缺乏短句与长句的爆发性交替；' +
  '* 信号D（教科书式中立）：仅有客观事实/数据罗列，完全没有任何撰写者的主观感悟、倾向或个人故事；' +
  '* 信号E（过渡词滥用）：频繁使用"值得注意的是""由此可见""毋庸置疑""不仅而且"等规范过渡词；' +
  '* 信号F（升华式结尾）：末段固定拉升到价值、意义、未来的宏大叙事；' +
  '* 信号G（高级伪装/拟人套路 - 重点识别）：用夸张的口语化伪装（如"直接点破""别再甩锅给""万万没想到""真相是"），但整体架构依然是极度工整的"总-分-总"；采用"标题党开头+权威背书+反常识观点+数字化方案+符号化对比（如使用"≠""+"）"的自媒体套路；每一句话都在高效推进论点，绝不产生无意义的废话。' +
  '* 注：单一连接词不构成 AI 判定。只有"连接词+工整句式+客观堆砌"同时满足时才升级判定。' +
  '### 第二阶段：维度量化计算' +
  '* perplexity（困惑度）：评估文本词汇预测难度。AI 文本困惑度显著偏低，词汇表达极易被预测；' +
  '* burstiness（爆发性）：评估句式长度与结构的变异度。AI 文本爆发性低（句子长短均匀），人类文本爆发性高（极短句与极长句交替）；' +
  '* patterns（特定模式）：必须精准引用文中出现的具体词汇或句式结构，严禁使用泛泛而谈的套话。' +
  '### 第三阶段：输出格式规范' +
  '1. 分级标准：high（句子概率≥70，典型AI句）；suggest（句子概率在55~69之间，有AI倾向建议修改）；概率低于55的句子绝对不要输出在 sentence_analysis 列表中。' +
  '2. 逐句覆盖要求：必须对全文每一句话逐一分析，sentence_analysis 列表必须包含所有概率≥55的句子，不得只挑最明显的几句而遗漏其他可疑句。每句话都要独立判断，给出各自的probability。' +
  '3. 字段要求：ai_probability 为全文综合概率（0-100整数），基于可疑句子权重动态计算，禁止输出固定数值；text 字段必须逐字复制原文，不得漏字改字；reason 必须直击要害，描述限制在30字以内。' +
  'Strictly output ONLY a valid, single-line JSON raw object without any markdown code block delimiters, no line breaks, and no additional text: ' +
  '{"ai_probability":73,"verdict":"中度疑似AI生成","dimensions":{"perplexity":"分析内容","burstiness":"分析内容","patterns":"分析内容"},"sentence_analysis":[{"text":"原文完整句子","level":"high","probability":78,"reason":"简短原因"}],"improvement_advice":"建议内容"}';

// ========== 豆包 Context API：模块级缓存 context_id（同进程内复用，冷启动重建）==========
let _doubaoContextId = config.DOUBAO_CONTEXT_ID || '';
let _doubaoContextKey = ''; // 记录创建时用的 API Key，切换 Key 时需重建

/**
 * 确保豆包上下文缓存存在，返回 context_id
 * 首次调用或 context 过期时自动创建
 */
async function ensureDoubaoContext(apiKey) {
  // 如果换了 API Key，需要重建 context（context 归属创建者的账号）
  if (_doubaoContextId && _doubaoContextKey === apiKey) {
    return _doubaoContextId;
  }

  if (!config.DOUBAO_MODEL) {
    throw new Error('豆包模式需配置 DOUBAO_MODEL（Endpoint ID），请在火山方舟控制台创建推理接入点');
  }

  const resp = await fetch(`${config.DOUBAO_BASE_URL}/context/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: config.DOUBAO_MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }],
      mode: 'common_prefix',
      ttl: config.DOUBAO_CONTEXT_TTL
    })
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`豆包上下文创建失败：${data?.error?.message || data?.message || JSON.stringify(data)}`);
  }

  _doubaoContextId = data.id;
  _doubaoContextKey = apiKey;
  return _doubaoContextId;
}

/**
 * 豆包 Context API 调用（带前缀缓存）
 * 返回 { result, cached_tokens }
 */
async function callDoubaoContext(text, apiKey) {
  const contextId = await ensureDoubaoContext(apiKey);

  let resp = await fetch(`${config.DOUBAO_BASE_URL}/context/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      context_id: contextId,
      model: config.DOUBAO_MODEL,
      messages: [{ role: 'user', content: text }],
      temperature: 0.1
      // 注意：Context API 不支持 response_format，靠 System Prompt 约束 JSON 输出
    })
  });

  let data = await resp.json();

  // context 过期（404 / invalid context_id）→ 重建后重试一次
  if (!resp.ok && (resp.status === 404 || /context.*(not found|expired|invalid)/i.test(JSON.stringify(data)))) {
    _doubaoContextId = '';
    _doubaoContextKey = '';
    const newContextId = await ensureDoubaoContext(apiKey);
    resp = await fetch(`${config.DOUBAO_BASE_URL}/context/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        context_id: newContextId,
        model: config.DOUBAO_MODEL,
        messages: [{ role: 'user', content: text }],
        temperature: 0.1
      })
    });
    data = await resp.json();
  }

  if (!resp.ok) {
    const err = new Error(data?.error?.message || data?.message || JSON.stringify(data));
    err.status = 502;
    throw err;
  }

  const content = data?.choices?.[0]?.message?.content || '{}';
  const cachedTokens = data?.usage?.prompt_tokens_details?.cached_tokens || 0;

  let result;
  try { result = JSON.parse(content); } catch { result = { raw: content, parse_error: true }; }

  return { result, cached_tokens: cachedTokens };
}

/**
 * 标准 OpenAI 格式调用（DeepSeek / 豆包 / 其他兼容厂商）
 * 自动兼容不支持 response_format 的厂商（如豆包标准接口）
 */
async function callStandard(text, apiKey, apiUrl, model) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: text }
  ];

  async function request(withJsonFormat) {
    const body = { model, messages, temperature: 0.1 };
    if (withJsonFormat) body.response_format = { type: 'json_object' };
    return fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(body)
    });
  }

  let resp = await request(true);
  let data = await resp.json();

  // 部分厂商（如豆包标准接口）不支持 response_format → 自动降级重试
  if (!resp.ok) {
    const errMsg = JSON.stringify(data).toLowerCase();
    if (/response_format|json_object|structured/.test(errMsg)) {
      resp = await request(false);
      data = await resp.json();
    }
  }

  if (!resp.ok) {
    const err = new Error(data?.error?.message || data?.message || JSON.stringify(data));
    err.status = 502;
    throw err;
  }

  const content = data?.choices?.[0]?.message?.content || '{}';
  let result;
  try { result = JSON.parse(content); } catch { result = { raw: content, parse_error: true }; }

  return { result, cached_tokens: 0 };
}

module.exports = async (req, res) => {
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }

  // 解析请求体
  let body = req.body;
  if (!body || typeof body === 'string') {
    try { body = body ? JSON.parse(body) : {}; } catch { return res.status(400).json({ error: '请求体格式错误' }); }
  }

  const { text, client_token, api_key, provider: userProvider } = body || {};

  // 文本校验
  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    return res.status(400).json({ error: '请输入至少 10 个字符的文本' });
  }
  if (text.length > config.MAX_TEXT_LENGTH * 3) {
    return res.status(400).json({ error: `文本过长，请控制在 ${config.MAX_TEXT_LENGTH} 字左右` });
  }

  // 判断是否使用自带 Key
  const useOwnKey = !!(api_key && typeof api_key === 'string' && api_key.trim().length > 10);
  // 自带 Key 时允许用户选择厂商，否则用全局配置
  const provider = (useOwnKey && userProvider === 'deepseek') ? 'deepseek'
    : (useOwnKey && userProvider === 'doubao') ? 'doubao'
    : config.AI_PROVIDER;

  let quota = null;
  let newClientToken = null;
  let cid = null;

  if (!useOwnKey) {
    const payload = verify(client_token);
    if (payload && typeof payload.q === 'number') {
      cid = payload.cid;
      quota = payload.q;
    } else {
      cid = genClientId();
      quota = config.FREE_QUOTA;
    }

    if (quota <= 0) {
      const article = randomArticle();
      const unlockToken = issueUnlockToken(cid);
      return res.status(200).json({
        locked: true,
        quota: 0,
        cid,
        article,
        unlock_token: unlockToken,
        client_token: issueClientToken(cid, 0)
      });
    }

    quota -= 1;
    newClientToken = issueClientToken(cid, quota);
  }

  // 选择 API Key 与调用方式
  let callResult;
  try {
    if (provider === 'doubao') {
      const apiKey = useOwnKey ? api_key.trim() : config.DOUBAO_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: '豆包模式需配置 DOUBAO_API_KEY，或使用「自带 API Key」模式' });
      }

      if (useOwnKey) {
        // 自带 Key：用标准聊天接口（每个用户 Key 不同，不共享 context 缓存）
        callResult = await callStandard(
          text, apiKey,
          `${config.DOUBAO_BASE_URL}/chat/completions`,
          config.DOUBAO_STANDARD_MODEL
        );
      } else {
        // 服务端 Key：用 Context API，前缀缓存命中
        callResult = await callDoubaoContext(text, apiKey);
      }
    } else {
      // deepseek / 其他兼容 OpenAI 格式厂商
      const apiKey = useOwnKey ? api_key.trim() : config.AI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: '服务端未配置 AI_API_KEY，请在环境变量中设置，或使用「自带 API Key」模式' });
      }
      // 自带 Key 选 DeepSeek 时用独立的 DeepSeek 地址/模型；否则用后端默认配置
      const apiUrl = useOwnKey ? config.DEEPSEEK_API_URL : config.AI_API_URL;
      const model = useOwnKey ? config.DEEPSEEK_MODEL : config.AI_MODEL;
      callResult = await callStandard(text, apiKey, apiUrl, model);
    }
  } catch (err) {
    return res.status(err.status || 500).json({
      error: err.status === 502 ? 'AI 服务调用失败' : '请求异常',
      detail: err.message
    });
  }

  // 组装响应
  const response = {
    result: callResult.result,
    useOwnKey,
    provider,
    cached_tokens: callResult.cached_tokens
  };
  if (!useOwnKey) {
    response.quota = quota;
    response.client_token = newClientToken;
  }
  return res.status(200).json(response);
};
