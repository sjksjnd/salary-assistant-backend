const cloud = require('wx-server-sdk');
const { ensureCollections } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function findUserByOpenid(openid) {
  if (!openid) return null;
  await ensureCollections(db, ['users']);
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 ? res.data[0] : null;
}

async function createDetectionRecord(userId, data) {
  await ensureCollections(db, ['detection_records']);
  const now = new Date();
  const res = await db.collection('detection_records').add({
    data: {
      userId,
      createdAt: now,
      ...data,
    },
  });
  return res._id;
}

module.exports = {
  db,
  _,
  findUserByOpenid,
  createDetectionRecord,
};
