const cloud = require('wx-server-sdk');
const { ensureCollections } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function ensureBaseCollections() {
  await ensureCollections(db, ['users', 'user_settings', 'workhour_records']);
}

async function findUserByOpenid(openid) {
  await ensureCollections(db, ['users']);
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 ? res.data[0] : null;
}

async function findUserSettings(userId) {
  await ensureCollections(db, ['user_settings']);
  const res = await db.collection('user_settings').where({ userId }).limit(1).get();
  return res.data.length > 0 ? res.data[0] : null;
}

async function findWorkRecord(userId, recordDate) {
  await ensureCollections(db, ['workhour_records']);
  const res = await db.collection('workhour_records')
    .where({ userId, recordDate })
    .limit(1)
    .get();
  return res.data.length > 0 ? res.data[0] : null;
}

async function createWorkRecord(userId, record) {
  await ensureCollections(db, ['workhour_records']);
  const now = new Date();
  const res = await db.collection('workhour_records').add({
    data: { userId, createdAt: now, updatedAt: now, ...record },
  });
  const created = await db.collection('workhour_records').doc(res._id).get();
  return created.data;
}

async function updateWorkRecord(id, record) {
  await ensureCollections(db, ['workhour_records']);
  const now = new Date();
  await db.collection('workhour_records').doc(id).update({
    data: { ...record, updatedAt: now },
  });
  const updated = await db.collection('workhour_records').doc(id).get();
  return updated.data;
}

async function findMonthRecords(userId, startDate, endDate) {
  await ensureCollections(db, ['workhour_records']);
  const res = await db.collection('workhour_records')
    .where({
      userId,
      recordDate: _.gte(startDate).and(_.lte(endDate)),
    })
    .orderBy('recordDate', 'asc')
    .limit(100)
    .get();
  return res.data;
}

async function deleteWorkRecord(id) {
  await ensureCollections(db, ['workhour_records']);
  await db.collection('workhour_records').doc(id).remove();
}

module.exports = {
  ensureBaseCollections,
  findUserByOpenid,
  findUserSettings,
  findWorkRecord,
  createWorkRecord,
  updateWorkRecord,
  findMonthRecords,
  deleteWorkRecord,
};
