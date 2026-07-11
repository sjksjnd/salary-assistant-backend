const cloud = require('wx-server-sdk');
const { ensureCollections } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function findUserByOpenid(openid) {
  await ensureCollections(db, ['users']);
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 ? res.data[0] : null;
}

async function findUserById(userId) {
  await ensureCollections(db, ['users']);
  const res = await db.collection('users').doc(userId).get();
  return res.data;
}

async function updateNickname(userId, nickname) {
  await ensureCollections(db, ['users']);
  await db.collection('users').doc(userId).update({
    data: { nickname: nickname.trim(), updatedAt: new Date() },
  });
  const user = await db.collection('users').doc(userId).get();
  return user.data;
}

async function updateAvatar(userId, avatarUrl) {
  await ensureCollections(db, ['users']);
  await db.collection('users').doc(userId).update({
    data: { avatarUrl, updatedAt: new Date() },
  });
}

async function findUserSettings(userId) {
  await ensureCollections(db, ['user_settings']);
  const res = await db.collection('user_settings').where({ userId }).limit(1).get();
  if (res.data.length > 0) return res.data[0];

  const now = new Date();
  const defaultSettings = {
    userId,
    hourlyRate: 25,
    nightRate: 20,
    standardHours: 8,
    factoryName: '',
    factoryCity: '',
    reminderEnabled: false,
    reminderTime: '21:00',
    fontScale: 'medium',
    defaultShift: 'day',
    createdAt: now,
    updatedAt: now,
  };
  await db.collection('user_settings').add({ data: defaultSettings });
  return defaultSettings;
}

async function updateSettings(settingsId, updateData) {
  await ensureCollections(db, ['user_settings']);
  await db.collection('user_settings').doc(settingsId).update({ data: updateData });
  const updated = await db.collection('user_settings').doc(settingsId).get();
  return updated.data;
}

module.exports = {
  findUserByOpenid,
  findUserById,
  updateNickname,
  updateAvatar,
  findUserSettings,
  updateSettings,
};
