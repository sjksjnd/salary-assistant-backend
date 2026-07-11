const cloud = require('wx-server-sdk');
const { ensureCollections } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function findArticles(category) {
  await ensureCollections(db, ['legal_articles']);
  let query = db.collection('legal_articles');
  if (category) {
    query = query.where({ category });
  }
  const res = await query.orderBy('source', 'asc').limit(200).get();
  return res.data;
}

async function findAllArticles(limit = 200) {
  await ensureCollections(db, ['legal_articles']);
  const res = await db.collection('legal_articles').limit(limit).get();
  return res.data;
}

async function getArticleById(id) {
  await ensureCollections(db, ['legal_articles']);
  const res = await db.collection('legal_articles').doc(id).get();
  return res.data;
}

module.exports = {
  findArticles,
  findAllArticles,
  getArticleById,
};
