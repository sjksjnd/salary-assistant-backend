const cloud = require('wx-server-sdk');
const { ensureCollections } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function ensureConfigCollections() {
  await ensureCollections(db, ['config_items', 'users', 'user_agreements']);
}

async function findConfigByKey(key) {
  await ensureCollections(db, ['config_items']);
  const res = await db.collection('config_items').where({ key }).limit(1).get();
  return res.data.length > 0 ? res.data[0] : null;
}

async function findAllConfigs() {
  await ensureCollections(db, ['config_items']);
  const res = await db.collection('config_items').limit(100).get();
  return res.data;
}

async function findUserByOpenid(openid) {
  if (!openid) return null;
  await ensureCollections(db, ['users']);
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 ? res.data[0] : null;
}

async function findUserAgreement(userId, agreementType) {
  await ensureCollections(db, ['user_agreements']);
  const res = await db.collection('user_agreements')
    .where({ userId, agreementType })
    .limit(1)
    .get();
  return res.data.length > 0 ? res.data[0] : null;
}

async function updateUserAgreement(id, version) {
  const now = new Date();
  await db.collection('user_agreements').doc(id).update({
    data: { version, acceptedAt: now },
  });
}

async function createUserAgreement(userId, agreementType, version) {
  await ensureCollections(db, ['user_agreements']);
  const now = new Date();
  await db.collection('user_agreements').add({
    data: { userId, agreementType, version, acceptedAt: now, createdAt: now },
  });
}

module.exports = {
  ensureConfigCollections,
  findConfigByKey,
  findAllConfigs,
  findUserByOpenid,
  findUserAgreement,
  updateUserAgreement,
  createUserAgreement,
};
