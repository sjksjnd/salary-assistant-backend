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
      case 'save':
        return await saveRecord(userId, event);
      case 'get':
        return await getRecord(userId, event.recordDate);
      case 'month':
        return await getMonthRecords(userId, event.month);
      case 'delete':
        return await deleteRecord(userId, event.recordDate);
      case 'batch':
        return await batchSave(userId, event.records);
      default:
        return fail(40001, '未知操作');
    }
  } catch (err) {
    console.error('[workhours error]', action, err);
    return fail(50001, '服务器内部错误');
  }
};

async function saveRecord(userId, event) {
  const { recordDate, hours, shift, payAmount: rawPay, rate } = service.normalizeRecordInput(event);

  const validation = service.validateRecord(recordDate, hours);
  if (!validation.valid) {
    return fail(40001, validation.message);
  }

  const settings = await repo.findUserSettings(userId);
  const payAmount = service.computePayIfNeeded(rawPay, hours, shift, settings);

  const existing = await repo.findWorkRecord(userId, recordDate);

  if (existing) {
    const updated = await repo.updateWorkRecord(existing._id, { hours, shift, payAmount, rate });
    return ok(service.formatRecord(updated), '保存成功');
  } else {
    const created = await repo.createWorkRecord(userId, { recordDate, hours, shift, payAmount, rate });
    return ok(service.formatRecord(created), '保存成功');
  }
}

async function getRecord(userId, recordDate) {
  const record = await repo.findWorkRecord(userId, recordDate);
  if (!record) return fail(40401, '记录不存在');
  return ok(service.formatRecord(record));
}

async function getMonthRecords(userId, month) {
  const validation = service.validateMonth(month);
  if (!validation.valid) {
    return fail(40001, validation.message);
  }

  const { startDate, endDate } = service.getMonthDateRange(month);
  const rawRecords = await repo.findMonthRecords(userId, startDate, endDate);
  const records = rawRecords.map(service.formatRecord);
  const summary = service.calculateSummary(records);

  return ok({ records, summary });
}

async function deleteRecord(userId, recordDate) {
  const record = await repo.findWorkRecord(userId, recordDate);
  if (!record) return fail(40401, '记录不存在');

  await repo.deleteWorkRecord(record._id);
  return ok(null, '删除成功');
}

async function batchSave(userId, records) {
  if (!Array.isArray(records) || records.length === 0) {
    return fail(40001, '记录不能为空');
  }
  if (records.length > 100) {
    return fail(40001, '单次最多保存100条');
  }

  const settings = await repo.findUserSettings(userId);
  const results = [];

  for (const r of records) {
    const { recordDate, hours, shift, payAmount: rawPay, rate } = service.normalizeRecordInput(r);

    if (!service.validateRecord(recordDate, hours).valid) continue;

    const payAmount = service.computePayIfNeeded(rawPay, hours, shift, settings);

    const existing = await repo.findWorkRecord(userId, recordDate);

    if (existing) {
      const updated = await repo.updateWorkRecord(existing._id, { hours, shift, payAmount, rate });
      results.push(updated);
    } else {
      const created = await repo.createWorkRecord(userId, { recordDate, hours, shift, payAmount, rate });
      results.push(created);
    }
  }

  return ok(results.map(service.formatRecord), '批量保存成功');
}
