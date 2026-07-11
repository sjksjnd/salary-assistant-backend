const cloud = require('wx-server-sdk');
const { ensureCollections } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function findUserByOpenid(openid) {
  if (!openid) return null;
  await ensureCollections(db, ['users']);
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 ? res.data[0] : null;
}

async function findDetectionRecords(userId, type, skip, limit) {
  await ensureCollections(db, ['detection_records']);
  let query = db.collection('detection_records').where({ userId });
  if (type) {
    query = db.collection('detection_records').where({ userId, type });
  }
  const res = await query.orderBy('createdAt', 'desc').skip(skip).limit(limit).get();
  return res.data;
}

async function countDetectionRecords(userId, type) {
  await ensureCollections(db, ['detection_records']);
  let query = db.collection('detection_records').where({ userId });
  if (type) {
    query = db.collection('detection_records').where({ userId, type });
  }
  const countRes = await query.count();
  return countRes.total;
}

async function findDetectionRecordById(id) {
  await ensureCollections(db, ['detection_records']);
  const doc = await db.collection('detection_records').doc(id).get();
  return doc.data;
}

async function deleteDetectionRecord(id) {
  await ensureCollections(db, ['detection_records']);
  await db.collection('detection_records').doc(id).remove();
}

module.exports = {
  findUserByOpenid,
  findDetectionRecords,
  countDetectionRecords,
  findDetectionRecordById,
  deleteDetectionRecord,
};
