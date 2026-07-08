const { query } = require('../config/database');
const redis = require('../config/redis');
const pkulawService = require('./pkulawService');
const logger = require('../utils/logger');

// Cache TTL for smartSearch results (seconds). Legal articles change rarely.
const SEARCH_CACHE_TTL = 600; // 10 minutes

function buildSearchCacheKey(q, limit) {
  // Normalize query to increase cache hit rate.
  const normalized = (q || '').trim().toLowerCase();
  return `legal:search:${Buffer.from(normalized).toString('base64')}:${limit}`;
}

const STOP_WORDS = ['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '什么', '怎么', '为什么', '可以', '吗', '呢', '啊', '吧', '呀', '哦', '嗯', '请问', '您好', '你好', '请问一下', '想咨询一下', '关于', '对于', '来说', '一下', '个', '之', '而', '及', '与', '或', '等', '等等', '哪些', '多少', '几', '如何', '怎样', '怎么样'];

const KEYWORD_WEIGHTS = {
  title: 3,
  keyword: 2,
  source: 2,
  text: 1
};

function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  
  const tokens = [];
  
  const cleanText = text.replace(/[，。！？、；：""''（）《》【】\n\r\t,.!?;:\'\"\(\)\[\]]/g, ' ');
  
  for (let len = 4; len >= 2; len--) {
    for (let i = 0; i <= cleanText.length - len; i++) {
      const word = cleanText.substring(i, i + len).trim();
      if (word.length >= 2 && STOP_WORDS.indexOf(word) === -1 && !/^\d+$/.test(word)) {
        tokens.push(word);
      }
    }
  }
  
  const singleChars = cleanText.split(' ').filter(s => s.length === 1 && STOP_WORDS.indexOf(s) === -1);
  tokens.push(...singleChars);
  
  return [...new Set(tokens)];
}

function calculateScore(article, queryTokens) {
  let score = 0;
  let matchedKeywords = [];
  
  const title = article.title || '';
  const source = article.source || '';
  const text = article.original_text || '';
  const keywords = Array.isArray(article.keywords) ? article.keywords : [];
  
  for (const token of queryTokens) {
    const lowerToken = token.toLowerCase();
    
    if (title.toLowerCase().indexOf(lowerToken) !== -1) {
      score += KEYWORD_WEIGHTS.title;
      if (matchedKeywords.indexOf(token) === -1) matchedKeywords.push(token);
    }
    
    if (source.toLowerCase().indexOf(lowerToken) !== -1) {
      score += KEYWORD_WEIGHTS.source;
      if (matchedKeywords.indexOf(token) === -1) matchedKeywords.push(token);
    }
    
    for (const kw of keywords) {
      if (String(kw).toLowerCase().indexOf(lowerToken) !== -1) {
        score += KEYWORD_WEIGHTS.keyword;
        if (matchedKeywords.indexOf(token) === -1) matchedKeywords.push(token);
        break;
      }
    }
    
    if (text.toLowerCase().indexOf(lowerToken) !== -1) {
      score += KEYWORD_WEIGHTS.text;
      if (matchedKeywords.indexOf(token) === -1) matchedKeywords.push(token);
    }
  }
  
  const matchRatio = matchedKeywords.length / Math.max(queryTokens.length, 1);
  score = score * (0.5 + matchRatio * 0.5);
  
  return { score, matchedKeywords };
}

function getCategoryLabel(category) {
  const labels = {
    'contract': '劳动合同',
    'wage': '工资报酬',
    'overtime': '加班工时',
    'social': '社会保险',
    'termination': '解除补偿',
    'dispute': '争议处理',
    'other': '其他权益'
  };
  return labels[category] || category;
}

function buildQuickAnswer(article, query) {
  const text = article.original_text || '';
  return buildQuickAnswerFromText(text, query);
}

function buildQuickAnswerFromText(text, query) {
  if (!text || !query) return '';
  
  const queryTokens = tokenize(query);
  
  let bestSnippet = '';
  let bestScore = 0;
  
  const sentences = text.split(/[。；\n]/).filter(s => s.trim().length > 5);
  
  for (const sentence of sentences) {
    let score = 0;
    for (const token of queryTokens) {
      if (sentence.toLowerCase().indexOf(token.toLowerCase()) !== -1) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestSnippet = sentence.trim();
    }
  }
  
  return bestSnippet;
}

async function smartSearch(query, limit, userId) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return [];
  }

  const maxResults = limit || 10;

  if (pkulawService.isEnabled()) {
    try {
      const pkulawResults = await pkulawService.semanticSearch(query, maxResults, userId);
      if (pkulawResults && pkulawResults.length > 0) {
        logger.info('PKULaw MCP search success:', query, pkulawResults.length);
        return pkulawResults.map(item => ({
          ...item,
          quickAnswer: item.originalText ? buildQuickAnswerFromText(item.originalText, query) : '',
          fromPkulaw: true
        }));
      }
    } catch (err) {
      logger.warn('PKULaw MCP search failed, fallback to local:', err.message);
    }
  }

  // Local fallback path: check Redis cache first (skipped for personalized PKULaw results).
  const cacheKey = buildSearchCacheKey(query, maxResults);
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (cacheErr) {
    logger.warn('Legal search cache read failed:', cacheErr.message);
  }

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return [];
  }

  const rows = await query('SELECT id, category, source, title, original_text, keywords, applicable_scenarios, created_at FROM legal_articles ORDER BY id');
  const articles = rows.map(normalize);

  const results = [];
  for (const article of articles) {
    const { score, matchedKeywords } = calculateScore(article, queryTokens);
    if (score > 0) {
      results.push({
        ...article,
        score: Math.round(score * 100) / 100,
        matchedKeywords,
        categoryLabel: getCategoryLabel(article.category),
        quickAnswer: buildQuickAnswer(article, query),
        fromPkulaw: false
      });
    }
  }

  results.sort((a, b) => b.score - a.score);

  const finalResults = results.slice(0, maxResults);

  // Cache the local search results (fire-and-forget, fail-open).
  try {
    await redis.setex(cacheKey, SEARCH_CACHE_TTL, JSON.stringify(finalResults));
  } catch (cacheErr) {
    logger.warn('Legal search cache write failed:', cacheErr.message);
  }

  return finalResults;
}

async function getArticlesByCategory(category) {
  const rows = await query(
    'SELECT id, category, source, title, original_text, keywords, applicable_scenarios, created_at FROM legal_articles WHERE category = ? ORDER BY id',
    [category]
  );
  return rows.map(normalize);
}

async function getArticlesByScenarios(scenarios) {
  const list = Array.isArray(scenarios) ? scenarios : [scenarios];
  if (list.length === 0) return [];

  const placeholders = list.map(() => 'JSON_CONTAINS(applicable_scenarios, JSON_QUOTE(?))').join(' OR ');
  const params = list.map(s => String(s));
  const rows = await query(
    `SELECT id, category, source, title, original_text, keywords, applicable_scenarios, created_at FROM legal_articles WHERE ${placeholders} ORDER BY id`,
    params
  );
  return rows.map(normalize);
}

async function searchArticles(keyword, limit) {
  if (!keyword || typeof keyword !== 'string') return [];
  const maxResults = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const like = `%${keyword}%`;
  const rows = await query(
    `SELECT id, category, source, title, original_text, keywords, applicable_scenarios, created_at FROM legal_articles
     WHERE title LIKE ? OR source LIKE ? OR keywords LIKE ?
     ORDER BY id
     LIMIT ?`,
    [like, like, like, maxResults]
  );
  return rows.map(normalize);
}

async function getArticleBySource(source) {
  const rows = await query('SELECT id, category, source, title, original_text, keywords, applicable_scenarios, created_at FROM legal_articles WHERE source = ?', [source]);
  return rows.length ? normalize(rows[0]) : null;
}

async function getAllCategories() {
  const rows = await query('SELECT DISTINCT category FROM legal_articles ORDER BY category');
  return rows.map(r => ({
    key: r.category,
    label: getCategoryLabel(r.category)
  }));
}

const SCENARIO_SOURCE_MAP = {
  probation_over_limit: ['《劳动合同法》第19条'],
  probation_salary_low: ['《劳动合同法》第20条'],
  no_social_security: ['《社会保险法》第58条'],
  wage_arrears: ['《劳动法》第50条'],
  wage_deduction: ['《劳动法》第50条'],
  overtime_no_pay: ['《劳动法》第44条', '《劳动合同法》第31条'],
  illegal_penalty: ['《劳动合同法》第25条'],
  unilateral_transfer: ['《劳动合同法》第35条'],
  non_compete_no_compensation: ['《劳动合同法》第23条'],
  non_compete_over_limit: ['《劳动合同法》第24条'],
  severance_pay: ['《劳动合同法》第47条'],
  unlawful_termination: ['《劳动合同法》第47条', '《劳动合同法》第38条'],
  unpaid_wage_resignation: ['《劳动合同法》第38条', '《劳动合同法》第47条'],
  no_social_resignation: ['《劳动合同法》第38条', '《社会保险法》第58条'],
  no_written_contract: ['《劳动合同法》第82条'],
  forced_overtime: ['《劳动合同法》第31条', '《劳动法》第44条']
};

async function getSourcesForScenarios(scenarios, userId) {
  const list = Array.isArray(scenarios) ? scenarios : [scenarios];
  if (list.length === 0) return [];

  if (pkulawService.isEnabled()) {
    const allKeywords = list
      .map(s => SCENARIO_KEYWORD_MAP[s] || s)
      .join(' ');

    try {
      const articles = await pkulawService.keywordSearch(allKeywords, Math.min(list.length * 2, 15), userId);
      if (articles && articles.length > 0) {
        return articles.map(a => ({ ...a, fromPkulaw: true }));
      }
    } catch (err) {
      logger.warn('PKULaw search failed for scenarios:', err.message);
    }
  }

  const sourceSet = new Set();
  for (const s of list) {
    const sources = SCENARIO_SOURCE_MAP[s] || [];
    for (const src of sources) sourceSet.add(src);
  }
  if (sourceSet.size === 0) return [];

  const placeholders = Array.from(sourceSet).map(() => '?').join(',');
  const rows = await query(
    `SELECT id, category, source, title, original_text, keywords, applicable_scenarios, created_at FROM legal_articles WHERE source IN (${placeholders}) ORDER BY id`,
    Array.from(sourceSet)
  );
  return rows.map(normalize);
}

const SCENARIO_KEYWORD_MAP = {
  probation_over_limit: '试用期 劳动合同法第19条',
  probation_salary_low: '试用期工资 劳动合同法第20条',
  no_social_security: '社会保险 社会保险法第58条',
  wage_arrears: '拖欠工资 劳动法第50条',
  wage_deduction: '工资扣除 工资支付暂行规定第16条',
  overtime_no_pay: '加班费 劳动法第44条',
  no_rest_day: '休息休假 劳动法第38条',
  severance_pay: '经济补偿 劳动合同法第47条',
  unlawful_termination: '违法解除 赔偿金 劳动合同法第87条',
  no_written_contract: '未签订劳动合同 双倍工资 劳动合同法第82条',
  dismissal_without_cause: '无故辞退 经济补偿 劳动合同法第46条',
  forced_resignation: '被迫辞职 经济补偿 劳动合同法第38条',
  work_injury: '工伤 工伤保险条例',
  maternity_leave: '产假 女职工劳动保护特别规定',
  arbitration_timelimit: '仲裁时效 劳动争议调解仲裁法第27条',
};

function normalize(row) {
  return {
    id: row.id,
    category: row.category,
    categoryLabel: getCategoryLabel(row.category),
    source: row.source,
    title: row.title,
    originalText: row.original_text,
    keywords: safeJsonParse(row.keywords, []),
    applicableScenarios: safeJsonParse(row.applicable_scenarios, [])
  };
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

module.exports = {
  getArticlesByCategory,
  getArticlesByScenarios,
  searchArticles,
  getArticleBySource,
  getSourcesForScenarios,
  smartSearch,
  getAllCategories,
  tokenize,
  calculateScore,
  SCENARIO_SOURCE_MAP,
  getCategoryLabel
};
