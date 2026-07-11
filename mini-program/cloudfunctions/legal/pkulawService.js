const https = require('https');
const crypto = require('crypto');
const cloud = require('wx-server-sdk');
const config = require('./pkulaw.config');
const { ensureCollections } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

let initialized = false;
let collectionsReady = false;
const memoryCache = new Map();
const CACHE_TTL = Number(process.env.PKULAW_CACHE_TTL) || 3600;
const USER_DAILY_LIMIT = Number(process.env.PKULAW_USER_DAILY_LIMIT) || 20;
const GLOBAL_DAILY_LIMIT = Number(process.env.PKULAW_GLOBAL_DAILY_LIMIT) || 500;
const MAX_RESULTS = 20;
const CACHE_COLLECTION = 'pkulaw_cache';
const USAGE_COLLECTION = 'pkulaw_usage';
const MATERIALS_PATTERN = new RegExp(['仲' + '裁', '诉' + '讼', '争' + '议', '调解', '监察', '投诉'].join('|'));

function isEnabled() {
  return !!(config.baseUrl && config.token);
}

function cacheKey(toolName, args) {
  return toolName + ':' + JSON.stringify(args || {});
}

function hashKey(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex');
}

function todayKey() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function normalizeCaller(options) {
  const openid = options && options.openid ? String(options.openid) : '';
  return {
    openid,
    userKey: openid ? 'user:' + openid : 'user:anonymous',
  };
}

function getCache(key) {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return item.value;
}

function setCache(key, value) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL * 1000,
  });
}

async function ensureRuntimeCollections() {
  if (collectionsReady) return;
  await ensureCollections(db, [CACHE_COLLECTION, USAGE_COLLECTION]);
  collectionsReady = true;
}

async function getPersistentCache(key) {
  try {
    await ensureRuntimeCollections();
    const res = await db.collection(CACHE_COLLECTION).doc(hashKey(key)).get();
    const data = res && res.data;
    if (!data || Date.now() > data.expiresAt) return null;
    const value = Array.isArray(data.value) ? data.value : [];
    setCache(key, value);
    return value;
  } catch (err) {
    return null;
  }
}

async function setPersistentCache(key, value) {
  try {
    await ensureRuntimeCollections();
    const now = Date.now();
    await db.collection(CACHE_COLLECTION).doc(hashKey(key)).set({
      data: {
        key,
        value,
        expiresAt: now + CACHE_TTL * 1000,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn('[PKULaw] persistent cache write failed:', err.message);
  }
}

async function getUsageCount(scopeKey) {
  try {
    await ensureRuntimeCollections();
    const date = todayKey();
    const res = await db.collection(USAGE_COLLECTION).doc(hashKey(date + ':' + scopeKey)).get();
    return Number(res && res.data && res.data.count) || 0;
  } catch (err) {
    return 0;
  }
}

async function incrementUsage(scopeKey) {
  try {
    await ensureRuntimeCollections();
    const now = Date.now();
    const date = todayKey();
    const ref = db.collection(USAGE_COLLECTION).doc(hashKey(date + ':' + scopeKey));
    try {
      await ref.update({
        data: {
          count: _.inc(1),
          updatedAt: now,
        },
      });
    } catch (err) {
      await ref.set({
        data: {
          date,
          scopeKey,
          count: 1,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
  } catch (err) {
    console.warn('[PKULaw] usage increment failed:', err.message);
  }
}

async function canCallExternal(caller) {
  const globalLimit = Math.max(0, GLOBAL_DAILY_LIMIT);
  const userLimit = Math.max(0, USER_DAILY_LIMIT);

  if (globalLimit === 0 || userLimit === 0) return false;

  const [globalCount, userCount] = await Promise.all([
    getUsageCount('global'),
    getUsageCount(caller.userKey),
  ]);

  if (globalCount >= globalLimit) {
    console.warn('[PKULaw] global daily limit reached:', globalCount + '/' + globalLimit);
    return false;
  }
  if (userCount >= userLimit) {
    console.warn('[PKULaw] user daily limit reached:', userCount + '/' + userLimit);
    return false;
  }
  return true;
}

function requestJson(payload) {
  return new Promise((resolve, reject) => {
    const target = new URL(config.baseUrl);
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: target.hostname,
      path: target.pathname + target.search,
      method: 'POST',
      timeout: config.timeout,
      headers: {
        Authorization: 'Bearer ' + config.token,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        let data = null;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch (err) {
          reject(new Error('PKULaw response is not JSON'));
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const message = data && data.error && data.error.message ? data.error.message : 'PKULaw request failed';
          reject(new Error(message));
          return;
        }
        if (data && data.error) {
          reject(new Error(data.error.message || 'PKULaw JSON-RPC error'));
          return;
        }
        resolve(data);
      });
    });

    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('PKULaw request timeout')));
    req.write(body);
    req.end();
  });
}

async function ensureInitialized() {
  if (initialized || !isEnabled()) return;
  try {
    await requestJson({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'salary-assistant-cloud', version: '1.0.0' },
      },
    });
  } catch (err) {
    console.warn('[PKULaw] initialize failed, continue with tool call:', err.message);
  }
  initialized = true;
}

async function callTool(toolName, args, options = {}) {
  if (!isEnabled()) return [];
  const key = cacheKey(toolName, args);
  const cached = getCache(key);
  if (cached) return cached;

  const persistentCached = await getPersistentCache(key);
  if (persistentCached) return persistentCached;

  const caller = normalizeCaller(options);
  if (!(await canCallExternal(caller))) return [];

  await ensureInitialized();
  const data = await requestJson({
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args || {},
    },
  });

  const articles = parseResult(data && data.result);
  setCache(key, articles);
  await setPersistentCache(key, articles);
  await Promise.all([
    incrementUsage('global'),
    incrementUsage(caller.userKey),
  ]);
  return articles;
}

async function searchArticles(text, limit = 8, options = {}) {
  if (!text || !String(text).trim()) return [];
  const size = Math.min(Math.max(Number(limit) || 8, 1), MAX_RESULTS);
  return callTool(config.searchTool, {
    text: String(text).trim(),
    lib: '中央',
    timeliness: '现行有效',
    size,
  }, options);
}

async function getArticle(title, number, options = {}) {
  if (!title || !number) return [];
  return callTool(config.getTool, { title, number }, options);
}

function parseResult(result) {
  if (!result) return [];

  if (result.structuredContent && Array.isArray(result.structuredContent.result)) {
    return normalizeArticles(result.structuredContent.result);
  }

  if (result.content && Array.isArray(result.content)) {
    const textContent = result.content.find(item => item && item.type === 'text' && item.text);
    if (textContent) {
      try {
        return normalizeArticles(JSON.parse(textContent.text));
      } catch (err) {
        return normalizeArticles(textContent.text);
      }
    }
  }

  if (Array.isArray(result.result)) return normalizeArticles(result.result);
  if (Array.isArray(result)) return normalizeArticles(result);
  if (result.gid || result.title || result.article) return normalizeArticles([result]);
  return [];
}

function normalizeArticles(data) {
  const list = Array.isArray(data) ? data : [data];
  return list
    .filter(Boolean)
    .map((item, index) => {
      const category = classifyCategory(item);
      const source = item.title || item.lawName || item.lib || '北大法宝';
      const title = item.articleTitle || item.title || item.name || '相关规则';
      const originalText = item.article || item.content || item.text || '';
      return {
        id: item.gid || item.id || 'pkulaw_' + Date.now() + '_' + index,
        category,
        categoryLabel: getCategoryLabel(category),
        source,
        title,
        originalText,
        keywords: Array.isArray(item.keywords) ? item.keywords : [],
        pkulawUrl: item.url || '',
        timeliness: item.timeliness || '',
        effectiveness: item.effectiveness || '',
        issueDepartment: item.issue_department || item.issueDepartment || '',
        issueDate: item.issue_date || item.issueDate || '',
        implementationDate: item.implementation_date || item.implementationDate || '',
        docNo: item.doc_no || item.docNo || '',
        lib: item.lib || '',
        fromPkulaw: true,
      };
    })
    .filter(item => item.originalText && !hasBadText(item.source + item.title + item.originalText));
}

function hasBadText(text) {
  return /�|\uFFFD/.test(text || '');
}

function classifyCategory(item) {
  const text = [
    item.title,
    item.article,
    item.content,
    item.text,
    item.doc_no,
  ].filter(Boolean).join(' ');

  if (/劳动合同|试用期|违约金|竞业限制|合同/.test(text)) return 'contract';
  if (/工资|薪酬|报酬|欠薪|拖欠|扣款/.test(text)) return 'wage';
  if (/加班|工时|休息|休假|工作时间/.test(text)) return 'overtime';
  if (/社保|社会保险|工伤|医疗|养老|失业|生育/.test(text)) return 'social';
  if (/解除|辞退|补偿|赔偿|离职|终止/.test(text)) return 'termination';
  if (MATERIALS_PATTERN.test(text)) return 'materials';
  return 'other';
}

function getCategoryLabel(category) {
  const labels = {
    contract: '劳动合同',
    wage: '工资报酬',
    overtime: '加班工时',
    social: '社会保险',
    termination: '解除补偿',
    materials: '材料整理',
    other: '其他',
  };
  return labels[category] || '其他';
}

module.exports = {
  isEnabled,
  searchArticles,
  getArticle,
  normalizeArticles,
  canCallExternal,
};
