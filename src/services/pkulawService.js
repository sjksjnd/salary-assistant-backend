const axios = require('axios');
const logger = require('../utils/logger');
const guard = require('../middleware/pkulawGuard');

const MCP_CONFIG = {
  baseUrl: process.env.PKULAW_MCP_URL || 'https://apim-gateway.pkulaw.com/mcp-law-search-service',
  token: process.env.PKULAW_MCP_TOKEN || '',
  timeout: parseInt(process.env.PKULAW_MCP_TIMEOUT, 10) || 15000,
};

const TOOL_NAMES = {
  SEARCH_ARTICLE: process.env.PKULAW_TOOL_SEARCH || 'search_article',
  GET_ARTICLE: process.env.PKULAW_TOOL_GET || 'get_article',
};

function isEnabled() {
  return !!(MCP_CONFIG.baseUrl && MCP_CONFIG.token);
}

let _initialized = false;

async function ensureInitialized() {
  if (_initialized) return;

  try {
    await axios.post(
      MCP_CONFIG.baseUrl,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'worker-law-app', version: '1.0.0' },
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${MCP_CONFIG.token}`,
          'Content-Type': 'application/json',
        },
        timeout: MCP_CONFIG.timeout,
      }
    );
    _initialized = true;
    logger.info('[PKULaw] MCP initialized');
  } catch (err) {
    logger.warn('[PKULaw] init failed, proceeding anyway:', err.message);
    _initialized = true;
  }
}

async function callTool(toolName, args) {
  if (!isEnabled()) {
    throw new Error('PKULaw MCP is not configured');
  }

  await ensureInitialized();

  try {
    const response = await axios.post(
      MCP_CONFIG.baseUrl,
      {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name: toolName, arguments: args },
      },
      {
        headers: {
          'Authorization': `Bearer ${MCP_CONFIG.token}`,
          'Content-Type': 'application/json',
        },
        timeout: MCP_CONFIG.timeout,
      }
    );

    const data = response.data;
    if (data && data.result) {
      return data.result;
    }
    return data;
  } catch (err) {
    logger.error('PKULaw MCP call error:', err.message);
    if (err.response && err.response.data) {
      logger.error('Response data:', JSON.stringify(err.response.data));
    }
    throw err;
  }
}

async function semanticSearch(query, limit, userId) {
  if (!userId) {
    userId = 'system';
  }

  const size = Math.min(Math.max(limit || 10, 1), 20);
  const args = { text: query, size };

  const result = await guard.withProtection(userId, TOOL_NAMES.SEARCH_ARTICLE, args, async () => {
    const raw = await callTool(TOOL_NAMES.SEARCH_ARTICLE, args);
    return parseResult(raw);
  });

  if (result.blocked) {
    logger.warn(`[PKULaw] user ${userId} blocked: ${result.quota.reason}`);
    return [];
  }

  return result.data;
}

async function keywordSearch(keyword, limit, userId) {
  return semanticSearch(keyword, limit, userId);
}

async function lookupArticle(title, number, userId) {
  if (!userId) {
    userId = 'system';
  }

  const args = { title, number };
  const cacheKey = `${TOOL_NAMES.GET_ARTICLE}:${title}:${number}`;

  const result = await guard.withProtection(userId, cacheKey, args, async () => {
    const raw = await callTool(TOOL_NAMES.GET_ARTICLE, args);
    return parseResult(raw);
  });

  if (result.blocked) {
    logger.warn(`[PKULaw] user ${userId} blocked: ${result.quota.reason}`);
    return [];
  }

  return result.data;
}

function parseResult(result) {
  if (!result) return [];

  if (result.content && Array.isArray(result.content)) {
    const textContent = result.content.find(item => item.type === 'text');
    if (textContent && textContent.text) {
      try {
        const parsed = JSON.parse(textContent.text);
        return normalizeArticles(parsed);
      } catch (e) {
        return normalizeArticles(textContent.text);
      }
    }
  }

  if (result.result && Array.isArray(result.result)) {
    return normalizeArticles(result.result);
  }

  if (Array.isArray(result)) {
    return normalizeArticles(result);
  }

  if (result.gid || result.title) {
    return normalizeArticles([result]);
  }

  return [];
}

function normalizeArticles(data) {
  if (!data) return [];

  const articles = Array.isArray(data) ? data : [data];

  return articles.map((item, index) => ({
    id: item.gid || item.id || `pkulaw_${Date.now()}_${index}`,
    title: item.article || item.title || item.name || '未命名法条',
    source: item.title || item.lawName || item.lib || '',
    originalText: item.article || item.content || item.text || '',
    category: item.category || classifyCategory(item),
    categoryLabel: item.categoryLabel || getCategoryLabel(item.category || classifyCategory(item)),
    keywords: item.keywords || item.tags || [],
    pkulawUrl: item.url || '',
    timeliness: item.timeliness || '',
    effectiveness: item.effectiveness || '',
    issueDepartment: item.issue_department || '',
    issueDate: item.issue_date || '',
    implementationDate: item.implementation_date || '',
    docNo: item.doc_no || '',
    lib: item.lib || '',
    score: item.score != null ? item.score : 0,
    matchedKeywords: item.matchedKeywords || [],
  }));
}

function classifyCategory(item) {
  const text = `${item.title || ''} ${item.article || ''} ${item.lib || ''}`;

  if (/劳动合同|合同法/.test(text)) return 'contract';
  if (/工资|报酬|薪资|拖欠|克扣/.test(text)) return 'wage';
  if (/加班|工时|工作时间|休息|休假/.test(text)) return 'overtime';
  if (/社保|保险|工伤|医疗|养老|失业|生育/.test(text)) return 'social';
  if (/解除|辞退|补偿|赔偿|离职|终止/.test(text)) return 'termination';
  if (/仲裁|诉讼|争议|调解/.test(text)) return 'dispute';
  return 'other';
}

function getCategoryLabel(category) {
  const labels = {
    'contract': '劳动合同',
    'wage': '工资报酬',
    'overtime': '加班工时',
    'social': '社会保险',
    'termination': '解除补偿',
    'dispute': '争议处理',
    'other': '其他权益',
  };
  return labels[category] || '其他';
}

module.exports = {
  isEnabled,
  semanticSearch,
  keywordSearch,
  lookupArticle,
  TOOL_NAMES,
};
