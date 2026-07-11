const pkulawService = require('./pkulawService');

const STOP_WORDS = [
  '的', '了', '是', '在', '和', '与', '或', '吗', '呢', '啊', '请问', '你好',
  '什么', '怎么', '如何', '可以', '是否', '有没有', '多少', '哪些', '一个',
];

const KEYWORD_WEIGHTS = { title: 3, keyword: 2, source: 2, text: 1 };

const CATEGORIES = [
  { key: 'contract', label: '劳动合同' },
  { key: 'wage', label: '工资报酬' },
  { key: 'overtime', label: '加班工时' },
  { key: 'social', label: '社会保险' },
  { key: 'termination', label: '解除补偿' },
  { key: 'dispute', label: '争议处理' },
];

const SCENARIO_KEYWORDS = {
  probation_over_limit: '劳动合同法 试用期 第十九条',
  probation_salary_low: '劳动合同法 试用期工资 第二十条',
  no_social_security: '社会保险 用人单位 缴纳 第五十八条',
  wage_arrears: '劳动法 工资 按月支付 第五十条',
  wage_deduction: '工资支付 克扣 扣款',
  overtime_no_pay: '劳动法 加班工资 第四十四条',
  no_overtime_pay: '劳动法 加班工资 第四十四条',
  unreasonable_deduction: '工资支付 克扣 扣款',
  no_rest_day: '劳动法 休息休假 工作时间',
  severance_pay: '劳动合同法 经济补偿 第四十七条',
  unlawful_termination: '劳动合同法 违法解除 赔偿 第八十七条',
  no_written_contract: '劳动合同法 未签书面劳动合同 二倍工资 第八十二条',
  illegal_penalty: '劳动合同法 违约金 第二十五条',
  non_compete: '劳动合同法 竞业限制 补偿',
  training_penalty: '劳动合同法 培训服务期 违约金',
  contract_term: '劳动合同期限 固定期限 无固定期限',
  wage_clause: '劳动合同 劳动报酬 工资标准',
};

function getCategories() {
  return CATEGORIES;
}

function getCategoryLabel(category) {
  const item = CATEGORIES.find(x => x.key === category);
  return item ? item.label : '其他';
}

function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  const cleanText = text.replace(/[，。！？、；：“”‘’（）《》【】\n\r\t,.!?;:'"()[\]]/g, ' ');
  const tokens = [];

  for (let len = 4; len >= 2; len--) {
    for (let i = 0; i <= cleanText.length - len; i++) {
      const word = cleanText.substring(i, i + len).trim();
      if (word.length >= 2 && STOP_WORDS.indexOf(word) === -1 && !/^\d+$/.test(word)) {
        tokens.push(word);
      }
    }
  }

  return [...new Set(tokens)];
}

function calculateScore(article, queryTokens) {
  let score = 0;
  const matchedKeywords = [];
  const title = article.title || '';
  const source = article.source || '';
  const text = article.originalText || article.original_text || '';
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

  return { score, matchedKeywords };
}

function formatArticle(a) {
  const category = a.category || 'other';
  return {
    id: a._id || a.id,
    category,
    categoryLabel: a.categoryLabel || getCategoryLabel(category),
    source: a.source,
    title: a.title,
    originalText: a.originalText || a.original_text || '',
    keywords: a.keywords || [],
    applicableScenarios: a.applicableScenarios || a.applicable_scenarios || [],
    pkulawUrl: a.pkulawUrl || '',
    timeliness: a.timeliness || '',
    fromPkulaw: !!a.fromPkulaw,
    createdAt: a.createdAt,
  };
}

function searchArticles(allArticles, q, limit = 50) {
  if (!q || !q.trim()) return [];
  const maxLimit = Math.min(Number(limit) || 50, 100);
  const queryTokens = tokenize(q);
  if (queryTokens.length === 0) return [];

  const results = [];
  for (const article of allArticles) {
    const { score, matchedKeywords } = calculateScore(article, queryTokens);
    if (score > 0) {
      results.push({ ...formatArticle(article), score, matchedKeywords });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxLimit);
}

async function smartSearch(allArticles, q, limit = 20, options = {}) {
  if (!q || !q.trim()) return { results: [], total: 0, summary: '找到 0 条相关结果' };
  const maxLimit = Math.min(Number(limit) || 20, 50);

  let pkulawResults = [];
  if (pkulawService.isEnabled()) {
    try {
      pkulawResults = await pkulawService.searchArticles(q, maxLimit, options);
    } catch (err) {
      console.warn('[PKULaw] search failed, fallback to local:', err.message);
    }
  }

  const localResults = searchArticles(allArticles, q, maxLimit);
  const results = mergeArticles(pkulawResults, localResults).slice(0, maxLimit);

  return {
    results,
    total: results.length,
    summary: '找到 ' + results.length + ' 条相关结果',
  };
}

function buildAnswer(q, articles) {
  if (!articles.length) {
    return '暂未找到直接匹配的相关规则。可以换一个关键词，或拨打 12333 咨询当地劳动保障部门。';
  }

  const lines = ['根据你填写的信息，找到以下相关规则：'];
  articles.slice(0, 3).forEach((a, i) => {
    const text = a.originalText || '';
    const snippet = text.length > 120 ? text.substring(0, 120) + '...' : text;
    lines.push((i + 1) + '. ' + (a.title || a.source || '相关规则'));
    if (snippet) lines.push(snippet);
  });
  return lines.join('\n');
}

function askQuestion(q, articles) {
  const relatedArticles = articles.slice(0, 5).map(formatArticle);
  return {
    answer: buildAnswer(q, relatedArticles),
    relatedArticles,
    totalResults: relatedArticles.length,
    sources: relatedArticles.slice(0, 3).map(a => ({ title: a.title, source: a.source })),
  };
}

async function searchByScenarios(allArticles, scenarios, limit = 10, options = {}) {
  const list = Array.isArray(scenarios) ? scenarios : [scenarios];
  const query = list.map(s => SCENARIO_KEYWORDS[s] || s).filter(Boolean).join(' ');
  if (!query) return [];

  const result = await smartSearch(allArticles, query, limit, options);
  return result.results || [];
}

function mergeArticles(primary, fallback) {
  const seen = new Set();
  const result = [];
  for (const item of [].concat(primary || [], fallback || [])) {
    const article = formatArticle(item);
    const key = article.pkulawUrl || article.id || article.source + article.title + article.originalText;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(article);
  }
  return result;
}

module.exports = {
  getCategories,
  getCategoryLabel,
  tokenize,
  calculateScore,
  formatArticle,
  searchArticles,
  smartSearch,
  askQuestion,
  searchByScenarios,
  SCENARIO_KEYWORDS,
};
