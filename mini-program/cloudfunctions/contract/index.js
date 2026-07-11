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
  const action = event.action || 'list';

  try {
    const user = await repo.findUserByOpenid(openid);
    if (!user) return fail(40101, '用户不存在');
    const userId = user._id;

    switch (action) {
      case 'detect':
        return await detect(userId, openid, event);
      case 'records':
        return await getRecords(userId, event);
      case 'recordDetail':
        return await getRecordDetail(userId, event.id);
      case 'deleteRecord':
        return await deleteRecord(userId, event.id);
      default:
        return fail(40001, '未知操作');
    }
  } catch (err) {
    console.error('[contract error]', action, err);
    return fail(50001, '合同自查暂时不可用');
  }
};

async function detect(userId, openid, event) {
  const { type, content, fileUrl } = service.normalizeDetectInput(event);

  const validation = service.validateDetectInput(content, fileUrl);
  if (!validation.valid) {
    return fail(40001, validation.message);
  }

  const issues = service.performChecks(type, content);
  const legalArticles = await getLegalArticlesForIssues(issues, openid);
  const resultText = service.generateResultText(issues.length);
  const description = service.formatDescription(content);

  await repo.createDetectionRecord(userId, {
    type,
    description,
    resultText,
    resultDetail: JSON.stringify({ issues, legalArticles }),
  });

  return ok({
    issues,
    legalArticles,
    totalIssues: issues.length,
    riskLevel: service.calculateRiskLevel(issues.length),
    summary: service.generateSummary(issues.length),
  }, '自查完成');
}

async function getLegalArticlesForIssues(issues, callerOpenid = '') {
  const scenarios = service.inferScenariosFromIssues(issues);
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
    const result = res.result || {};
    return result.code === 0 && Array.isArray(result.data) ? result.data : [];
  } catch (err) {
    console.warn('[contract] legal scenario search failed:', err.message);
    return [];
  }
}

async function getRecords(userId, event) {
  const { type, page, pageSize, skip, limit } = service.normalizeRecordsInput(event);

  const records = await repo.findDetectionRecords(userId, type, skip, limit);
  const total = await repo.countDetectionRecords(userId, type);

  return ok({
    items: records.map(service.formatRecordList),
    total,
    page,
    pageSize: limit,
    hasMore: skip + limit < total,
  });
}

async function getRecordDetail(userId, id) {
  const record = await repo.findDetectionRecordById(id);
  if (!record || record.userId !== userId) return fail(40401, '记录不存在');

  return ok(service.formatRecordDetail(record));
}

async function deleteRecord(userId, id) {
  const record = await repo.findDetectionRecordById(id);
  if (!record || record.userId !== userId) return fail(40401, '记录不存在');

  await repo.deleteDetectionRecord(id);
  return ok(null, '删除成功');
}
