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
  const action = event.action || 'login';

  try {
    switch (action) {
      case 'login':
        return await handleLogin(openid, event);
      case 'logout':
        return await handleLogout(openid);
      case 'profile':
        return await handleProfile(openid);
      default:
        return fail(40001, '未知操作');
    }
  } catch (err) {
    console.error('[auth error]', action, err);
    return fail(50001, '服务器内部错误');
  }
};

async function handleLogin(openid, event) {
  await repo.ensureAuthCollections();

  let user = await repo.findUserByOpenid(openid);
  let isNewUser = false;

  if (!user) {
    const userData = service.buildNewUserData(openid, event.nickname, event.avatarUrl);
    user = await repo.createUser(userData);
    isNewUser = true;
    const settings = service.buildDefaultUserSettings(user._id);
    await repo.createUserSettings(settings);
  } else {
    await repo.updateUserLastLogin(user._id);
    if (event.nickname || event.avatarUrl) {
      const updateData = service.buildUpdateProfileData(event.nickname, event.avatarUrl);
      await repo.updateUserProfile(user._id, updateData);
      user = await repo.findUserByOpenid(openid);
    }
  }

  return ok({
    user: service.formatUserLogin(user),
    isNewUser,
  }, '登录成功');
}

async function handleLogout(openid) {
  return ok(null, '登出成功');
}

async function handleProfile(openid) {
  const user = await repo.findUserByOpenid(openid);
  if (!user) return fail(40401, '用户不存在');

  return ok(service.formatUserProfile(user));
}
