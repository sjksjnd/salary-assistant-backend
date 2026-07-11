const cloud = require('wx-server-sdk');
const service = require('./service');
const repo = require('./repository');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function ok(data = null, message = 'success') {
  return { code: 0, message, data };
}

function fail(code, message, data = null) {
  return { code, message, data };
}

exports.main = async (event) => {
  const action = event.action || 'list';
  const wxContext = cloud.getWXContext();
  const caller = { openid: wxContext.OPENID || event.callerOpenid || '' };

  try {
    switch (action) {
      case 'categories':
        return ok(service.getCategories());
      case 'articles':
        return await getArticles(event.category);
      case 'search':
        return await searchArticles(event.q, event.limit);
      case 'smartSearch':
        return await smartSearch(event.q, event.limit, caller);
      case 'ask':
        return await askQuestion(event.q || event.question, event.limit, caller);
      case 'scenarioSearch':
        return await scenarioSearch(event.scenarios, event.limit, caller);
      default:
        return fail(40001, '未知操作');
    }
  } catch (err) {
    console.error('[legal error]', action, err);
    return fail(50001, '规则信息暂时不可用');
  }
};

async function getArticles(category) {
  const articles = await repo.findArticles(category);
  return ok(articles.map(service.formatArticle));
}

async function searchArticles(q, limit = 50) {
  if (!q || !q.trim()) return ok([]);
  const maxLimit = Math.min(Number(limit) || 50, 100);
  const allArticles = await repo.findAllArticles(200);
  const results = service.searchArticles(allArticles, q, maxLimit);
  return ok(results);
}

async function smartSearch(q, limit = 20, caller = {}) {
  if (!q || !q.trim()) return ok({ results: [], total: 0, summary: '找到 0 条相关结果' });
  const allArticles = await repo.findAllArticles(200);
  const result = await service.smartSearch(allArticles, q, limit, caller);
  return ok(result);
}

async function askQuestion(q, limit = 10, caller = {}) {
  if (!q || !q.trim()) return fail(40001, '请输入要查询的问题');
  const allArticles = await repo.findAllArticles(200);
  const searchResult = await service.smartSearch(allArticles, q, limit || 10, caller);
  const answer = service.askQuestion(q, searchResult.results || []);
  return ok(answer);
}

async function scenarioSearch(scenarios, limit = 10, caller = {}) {
  const list = Array.isArray(scenarios) ? scenarios : [scenarios].filter(Boolean);
  if (!list.length) return ok([]);
  const allArticles = await repo.findAllArticles(200);
  const articles = await service.searchByScenarios(allArticles, list, limit, caller);
  return ok(articles);
}
