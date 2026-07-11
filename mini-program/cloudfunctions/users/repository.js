const cloud = require('wx-server-sdk');
const { ensureCollections } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const USER_DATA_COLLECTIONS = [
  'user_settings',
  'user_agreements',
  'workhour_records',
  'salary_deductions',
  'salary_expenses',
  'salary_advances',
  'salary_bills',
  'detection_records',
];

async function findUserByOpenid(openid) {
  if (!openid) return null;
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

async function findUserData(userId, openid) {
  await ensureCollections(db, USER_DATA_COLLECTIONS);
  const result = {};
  for (const name of USER_DATA_COLLECTIONS) {
    const res = await db.collection(name).where({ userId }).limit(1000).get();
    result[name] = res.data || [];
  }

  await ensureCollections(db, ['pkulaw_usage']);
  const usage = await db.collection('pkulaw_usage').where({ scopeKey: 'user:' + openid }).limit(1000).get();
  result.pkulaw_usage = usage.data || [];
  return result;
}

async function removeCollectionDocsByUserId(collectionName, userId) {
  await ensureCollections(db, [collectionName]);
  let removed = 0;
  while (true) {
    const res = await db.collection(collectionName).where({ userId }).limit(100).get();
    const docs = res.data || [];
    if (!docs.length) break;
    await Promise.all(docs.map(item => db.collection(collectionName).doc(item._id).remove()));
    removed += docs.length;
    if (docs.length < 100) break;
  }
  return removed;
}

async function removePkulawUsage(openid) {
  await ensureCollections(db, ['pkulaw_usage']);
  let removed = 0;
  const scopeKey = 'user:' + openid;
  while (true) {
    const res = await db.collection('pkulaw_usage').where({ scopeKey }).limit(100).get();
    const docs = res.data || [];
    if (!docs.length) break;
    await Promise.all(docs.map(item => db.collection('pkulaw_usage').doc(item._id).remove()));
    removed += docs.length;
    if (docs.length < 100) break;
  }
  return removed;
}

async function deleteUserData(userId, openid) {
  const removed = {};
  for (const name of USER_DATA_COLLECTIONS) {
    removed[name] = await removeCollectionDocsByUserId(name, userId);
  }
  removed.pkulaw_usage = await removePkulawUsage(openid);

  await ensureCollections(db, ['users']);
  await db.collection('users').doc(userId).remove();
  removed.users = 1;
  return removed;
}

module.exports = {
  findUserByOpenid,
  findUserById,
  updateNickname,
  updateAvatar,
  findUserSettings,
  updateSettings,
  findUserData,
  deleteUserData,
};
