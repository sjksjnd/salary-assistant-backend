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
  const action = event.action || 'profile';

  try {
    const user = await repo.findUserByOpenid(openid);
    if (!user) return fail(40101, '用户不存在');
    const userId = user._id;

    switch (action) {
      case 'profile':
        return ok(service.formatUser(user));
      case 'updateNickname':
        return await updateNickname(userId, event.nickname);
      case 'updateAvatar':
        return await updateAvatar(userId, event.avatarUrl);
      case 'getSettings':
        return await getSettings(userId);
      case 'updateSettings':
        return await updateSettings(userId, event);
      case 'exportData':
        return await exportData(user, userId, openid);
      case 'deleteData':
        return await deleteData(userId, openid);
      default:
        return fail(40001, '未知操作');
    }
  } catch (err) {
    console.error('[users error]', action, err);
    return fail(50001, '服务器内部错误');
  }
};

async function updateNickname(userId, nickname) {
  const validation = service.validateNickname(nickname);
  if (!validation.valid) {
    return fail(40001, validation.message);
  }

  const updatedUser = await repo.updateNickname(userId, nickname);
  return ok(service.formatUser(updatedUser), '更新成功');
}

async function updateAvatar(userId, avatarUrl) {
  const validation = service.validateAvatar(avatarUrl);
  if (!validation.valid) {
    return fail(40001, validation.message);
  }

  await repo.updateAvatar(userId, avatarUrl);
  return ok({ avatarUrl }, '更新成功');
}

async function getSettings(userId) {
  const settings = await repo.findUserSettings(userId);
  return ok(service.formatSettings(settings));
}

async function updateSettings(userId, event) {
  const validation = service.validateSettingsUpdate(event);
  if (!validation.valid) {
    return fail(40001, validation.message);
  }

  const rawUpdateData = service.buildSettingsUpdateData(event);
  const updateData = service.normalizeSettingsUpdateData(rawUpdateData);

  const settings = await repo.findUserSettings(userId);
  const updated = await repo.updateSettings(settings._id, updateData);
  return ok(service.formatSettings(updated), '保存成功');
}

async function exportData(user, userId, openid) {
  const data = await repo.findUserData(userId, openid);
  return ok(service.buildExportData(user, data), '导出成功');
}

async function deleteData(userId, openid) {
  const removed = await repo.deleteUserData(userId, openid);
  return ok({ removed }, '账号数据已删除');
}
