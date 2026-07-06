const { query } = require('../config/database');

/**
 * Find legal articles by category.
 * @param {string} category - e.g. 'contract', 'wage', 'overtime', 'social', 'termination'
 * @returns {Promise<Array>}
 */
async function getArticlesByCategory(category) {
  const rows = await query(
    'SELECT * FROM legal_articles WHERE category = ? ORDER BY id',
    [category]
  );
  return rows.map(normalize);
}

/**
 * Find legal articles by applicable scenario tag(s).
 * @param {string|string[]} scenarios
 * @returns {Promise<Array>}
 */
async function getArticlesByScenarios(scenarios) {
  const list = Array.isArray(scenarios) ? scenarios : [scenarios];
  if (list.length === 0) return [];

  const placeholders = list.map(() => 'JSON_CONTAINS(applicable_scenarios, JSON_QUOTE(?))').join(' OR ');
  const params = list.map(s => String(s));
  const rows = await query(
    `SELECT * FROM legal_articles WHERE ${placeholders} ORDER BY id`,
    params
  );
  return rows.map(normalize);
}

/**
 * Search articles by keyword (simple LIKE over keywords JSON and title/source).
 * @param {string} keyword
 * @returns {Promise<Array>}
 */
async function searchArticles(keyword) {
  if (!keyword || typeof keyword !== 'string') return [];
  const like = `%${keyword}%`;
  const rows = await query(
    `SELECT * FROM legal_articles
     WHERE title LIKE ? OR source LIKE ? OR keywords LIKE ?
     ORDER BY id`,
    [like, like, like]
  );
  return rows.map(normalize);
}

/**
 * Get a single article by source citation.
 * @param {string} source - e.g. '《劳动合同法》第19条'
 * @returns {Promise<Object|null>}
 */
async function getArticleBySource(source) {
  const rows = await query('SELECT * FROM legal_articles WHERE source = ?', [source]);
  return rows.length ? normalize(rows[0]) : null;
}

/**
 * Map scenario codes to authoritative legal sources.
 * This is used to cross-check rule engine conclusions against the knowledge base.
 */
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

/**
 * Retrieve legal sources for given scenario codes.
 * @param {string|string[]} scenarios
 * @returns {Promise<Array>}
 */
async function getSourcesForScenarios(scenarios) {
  const list = Array.isArray(scenarios) ? scenarios : [scenarios];
  const sourceSet = new Set();
  for (const s of list) {
    const sources = SCENARIO_SOURCE_MAP[s] || [];
    for (const src of sources) sourceSet.add(src);
  }
  if (sourceSet.size === 0) return [];

  const placeholders = Array.from(sourceSet).map(() => '?').join(',');
  const rows = await query(
    `SELECT * FROM legal_articles WHERE source IN (${placeholders}) ORDER BY id`,
    Array.from(sourceSet)
  );
  return rows.map(normalize);
}

function normalize(row) {
  return {
    id: row.id,
    category: row.category,
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
  SCENARIO_SOURCE_MAP
};
