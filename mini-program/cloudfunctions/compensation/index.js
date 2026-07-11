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

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const action = event.action || 'calculate';

  try {
    switch (action) {
      case 'questions':
        return ok(service.getQuestions());
      case 'calculate':
        return calculate(openid, event);
      case 'getItems':
        return getItems(event.type);
      default:
        return fail(40001, '未知操作');
    }
  } catch (err) {
    console.error('[compensation error]', action, err);
    return fail(50001, '测算服务暂时不可用');
  }
};

async function calculate(openid, event) {
  const result = service.calculateCompensation(event);
  result.legalArticles = await getLegalArticlesForResult(event, result, openid);
  const user = await repo.findUserByOpenid(openid);
  if (user) {
    await repo.createDetectionRecord(user._id, {
      type: 'compensation',
      description: '金额参考测算',
      resultText: '参考金额 ¥' + (result.total || 0),
      resultDetail: JSON.stringify({ answers: event.answers || null, result }),
    });
  }
  return ok(result);
}

function getItems(type) {
  const items = service.getCompensationItems(type);
  return ok(items);
}

async function getLegalArticlesForResult(event, result, callerOpenid = '') {
  const scenarios = service.inferScenariosFromResult(event, result);
  if (!scenarios.length) return [];

  try {
    const res = await cloud.callFunction({
      name: 'legal',
      data: {
        action: 'scenarioSearch',
        scenarios,
        limit: Math.min(scenarios.length * 3, 12),
        callerOpenid,
      },
    });
    const payload = res.result || {};
    return payload.code === 0 && Array.isArray(payload.data) ? payload.data : [];
  } catch (err) {
    console.warn('[compensation] legal scenario search failed:', err.message);
    return [];
  }
}
