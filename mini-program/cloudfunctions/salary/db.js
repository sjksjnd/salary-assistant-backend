async function ensureCollection(db, name) {
  try {
    await db.createCollection(name);
  } catch (err) {
    const msg = String(err && (err.message || err.errMsg || ''));
    if (
      err.errCode === -502005 ||
      msg.indexOf('already exist') >= 0 ||
      msg.indexOf('collection exists') >= 0 ||
      msg.indexOf('DATABASE_COLLECTION_ALREADY_EXIST') >= 0
    ) {
      return;
    }
    throw err;
  }
}

async function ensureCollections(db, names) {
  for (const name of names) {
    await ensureCollection(db, name);
  }
}

module.exports = {
  ensureCollection,
  ensureCollections,
};
