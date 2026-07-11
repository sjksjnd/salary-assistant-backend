const cloud = require('wx-server-sdk');
const service = require('./service');
const repo = require('./repository');
const defaults = require('./defaults');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function ok(data = null, message = 'success') {
  return { code: 0, message, data };
}

function fail(code, message, data = null) {
  return { code, message, data };
}

exports.main = async (event = {}, context) => {
  const action = event.action || 'get';

  try {
    switch (action) {
      case 'get':
        return await getConfig(event.key);
      case 'list':
        return await listConfigs();
      case 'agreement':
        return await getAgreement(event.type);
      case 'acceptAgreement':
        return await acceptAgreement(event);
      default:
        return fail(40001, '未知操作');
    }
  } catch (err) {
    console.error('[config error]', action, err);
    return fail(50001, err.message || '服务器内部错误');
  }
};

async function getConfig(key) {
  const validation = service.validateConfigKey(key);
  if (!validation.valid) {
    return fail(40001, validation.message);
  }

  const item = await repo.findConfigByKey(key);
  if (item) return ok(item.value);

  const fallback = defaults.getDefaultConfig(key);
  if (fallback !== null) return ok(fallback);

  return fail(40401, '配置项不存在');
}

async function listConfigs() {
  const items = await repo.findAllConfigs();
  const configs = Object.assign(defaults.getAllDefaultConfigs(), service.formatConfigList(items));
  return ok(configs);
}

async function getAgreement(type) {
  const validation = service.validateAgreementType(type);
  if (!validation.valid) {
    return fail(40001, validation.message);
  }

  const item = await repo.findConfigByKey(`agreement_${type}`);
  const fallback = defaults.getDefaultConfig(`agreement_${type}`);
  return ok(service.formatAgreement(type, item, fallback));
}

async function acceptAgreement(event) {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { type, version } = event;

  const validation = service.validateAcceptAgreementParams(event);
  if (!validation.valid) {
    return fail(40001, validation.message);
  }

  if (!openid) return fail(40101, '请先登录');
  const user = await repo.findUserByOpenid(openid);
  if (!user) return fail(40101, '用户不存在');
  const userId = user._id;

  const existing = await repo.findUserAgreement(userId, type);

  if (existing) {
    await repo.updateUserAgreement(existing._id, version);
  } else {
    await repo.createUserAgreement(userId, type, version);
  }

  return ok(null, '已确认');
}
