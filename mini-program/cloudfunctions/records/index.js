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

exports.main = async (event = {}, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const action = event.action || 'records';

  try {
    if (!openid) return fail(40101, '请先登录');
    const user = await repo.findUserByOpenid(openid);
    if (!user) return fail(40101, '用户不存在');
    const userId = user._id;

    switch (action) {
      case 'records':
      case 'list':
        return await getRecords(userId, event);
      case 'recordDetail':
      case 'detail':
        return await getRecordDetail(userId, event.id);
      case 'deleteRecord':
      case 'delete':
        return await deleteRecord(userId, event.id);
      default:
        return fail(40001, '未知操作');
    }
  } catch (err) {
    console.error('[records error]', action, err);
    return fail(50001, '记录服务暂时不可用');
  }
};

async function getRecords(userId, event) {
  const { type, page, pageSize, skip, limit } = service.normalizeRecordsInput(event);
  const records = await repo.findDetectionRecords(userId, type, skip, limit);
  const total = await repo.countDetectionRecords(userId, type);

  return ok({
    items: records.map(service.formatRecordList),
    total,
    page,
    pageSize,
    hasMore: skip + limit < total,
  });
}

async function getRecordDetail(userId, id) {
  if (!id) return fail(40001, '记录ID不能为空');
  const record = await repo.findDetectionRecordById(id);
  if (!record || record.userId !== userId) return fail(40401, '记录不存在');
  return ok(service.formatRecordDetail(record));
}

async function deleteRecord(userId, id) {
  if (!id) return fail(40001, '记录ID不能为空');
  const record = await repo.findDetectionRecordById(id);
  if (!record || record.userId !== userId) return fail(40401, '记录不存在');

  await repo.deleteDetectionRecord(id);
  return ok(null, '删除成功');
}
