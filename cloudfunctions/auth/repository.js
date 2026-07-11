const cloud = require('wx-server-sdk');
const { ensureCollections } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function ensureAuthCollections() {
  await ensureCollections(db, ['users', 'user_settings']);
}

async function findUserByOpenid(openid) {
  await ensureCollections(db, ['users']);
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 ? res.data[0] : null;
}

async function createUser(userData) {
  await ensureCollections(db, ['users']);
  const res = await db.collection('users').add({ data: userData });
  return { _id: res._id, ...userData };
}

async function updateUserLastLogin(userId) {
  const now = new Date();
  await db.collection('users').doc(userId).update({
    data: { lastLoginAt: now, updatedAt: now },
  });
}

async function updateUserProfile(userId, data) {
  await db.collection('users').doc(userId).update({ data });
}

async function findUserSettings(userId) {
  const res = await db.collection('user_settings').where({ userId }).limit(1).get();
  return res.data.length > 0 ? res.data[0] : null;
}

async function createUserSettings(settings) {
  await ensureCollections(db, ['user_settings']);
  await db.collection('user_settings').add({ data: settings });
  return settings;
}

module.exports = {
  ensureAuthCollections,
  findUserByOpenid,
  createUser,
  updateUserLastLogin,
  updateUserProfile,
  findUserSettings,
  createUserSettings,
};
