const cloud = require('wx-server-sdk');
const { ensureCollections } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const SALARY_COLLECTIONS = [
  'users',
  'salary_deductions',
  'salary_expenses',
  'salary_advances',
  'salary_bills',
  'workhour_records',
];

async function ensureSalaryCollections() {
  await ensureCollections(db, SALARY_COLLECTIONS);
}

async function findUserByOpenid(openid) {
  if (!openid) return null;
  await ensureCollections(db, ['users']);
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 ? res.data[0] : null;
}

async function createDeduction(userId, data) {
  await ensureCollections(db, ['salary_deductions']);
  const now = new Date();
  const recordDate = data.recordDate || data.month + '-01';
  const res = await db.collection('salary_deductions').add({
    data: {
      userId,
      month: data.month,
      category: data.category,
      amount: data.amount,
      note: data.note,
      recordDate,
      createdAt: now,
      updatedAt: now,
    },
  });
  const created = await db.collection('salary_deductions').doc(res._id).get();
  return created.data;
}

async function findDeductionsByMonth(userId, month) {
  await ensureCollections(db, ['salary_deductions']);
  const res = await db.collection('salary_deductions')
    .where({ userId, month })
    .orderBy('recordDate', 'desc')
    .limit(200)
    .get();
  return res.data;
}

async function findDeductionById(id) {
  if (!id) return null;
  await ensureCollections(db, ['salary_deductions']);
  const doc = await db.collection('salary_deductions').doc(id).get();
  return doc.data || null;
}

async function deleteDeduction(id) {
  await ensureCollections(db, ['salary_deductions']);
  await db.collection('salary_deductions').doc(id).remove();
}

async function updateDeduction(id, data) {
  await ensureCollections(db, ['salary_deductions']);
  const now = new Date();
  const recordDate = data.recordDate || data.month + '-01';
  await db.collection('salary_deductions').doc(id).update({
    data: {
      month: data.month,
      category: data.category,
      amount: data.amount,
      note: data.note,
      recordDate,
      updatedAt: now,
    },
  });
  const updated = await db.collection('salary_deductions').doc(id).get();
  return updated.data;
}

async function createExpense(userId, data) {
  await ensureCollections(db, ['salary_expenses']);
  const now = new Date();
  const recordDate = data.recordDate || data.month + '-01';
  const res = await db.collection('salary_expenses').add({
    data: {
      userId,
      month: data.month,
      category: data.category,
      amount: data.amount,
      note: data.note,
      recordDate,
      createdAt: now,
      updatedAt: now,
    },
  });
  const created = await db.collection('salary_expenses').doc(res._id).get();
  return created.data;
}

async function findExpensesByMonth(userId, month) {
  await ensureCollections(db, ['salary_expenses']);
  const res = await db.collection('salary_expenses')
    .where({ userId, month })
    .orderBy('recordDate', 'desc')
    .limit(200)
    .get();
  return res.data;
}

async function findExpenseById(id) {
  if (!id) return null;
  await ensureCollections(db, ['salary_expenses']);
  const doc = await db.collection('salary_expenses').doc(id).get();
  return doc.data || null;
}

async function deleteExpense(id) {
  await ensureCollections(db, ['salary_expenses']);
  await db.collection('salary_expenses').doc(id).remove();
}

async function updateExpense(id, data) {
  await ensureCollections(db, ['salary_expenses']);
  const now = new Date();
  const recordDate = data.recordDate || data.month + '-01';
  await db.collection('salary_expenses').doc(id).update({
    data: {
      month: data.month,
      category: data.category,
      amount: data.amount,
      note: data.note,
      recordDate,
      updatedAt: now,
    },
  });
  const updated = await db.collection('salary_expenses').doc(id).get();
  return updated.data;
}

async function createAdvance(userId, data) {
  await ensureCollections(db, ['salary_advances']);
  const now = new Date();
  const recordDate = data.recordDate || data.month + '-01';
  const res = await db.collection('salary_advances').add({
    data: {
      userId,
      month: data.month,
      amount: data.amount,
      note: data.note,
      recordDate,
      createdAt: now,
      updatedAt: now,
    },
  });
  const created = await db.collection('salary_advances').doc(res._id).get();
  return created.data;
}

async function findAdvancesByMonth(userId, month) {
  await ensureCollections(db, ['salary_advances']);
  const res = await db.collection('salary_advances')
    .where({ userId, month })
    .orderBy('recordDate', 'desc')
    .limit(200)
    .get();
  return res.data;
}

async function findAdvanceById(id) {
  if (!id) return null;
  await ensureCollections(db, ['salary_advances']);
  const doc = await db.collection('salary_advances').doc(id).get();
  return doc.data || null;
}

async function deleteAdvance(id) {
  await ensureCollections(db, ['salary_advances']);
  await db.collection('salary_advances').doc(id).remove();
}

async function updateAdvance(id, data) {
  await ensureCollections(db, ['salary_advances']);
  const now = new Date();
  const recordDate = data.recordDate || data.month + '-01';
  await db.collection('salary_advances').doc(id).update({
    data: {
      month: data.month,
      amount: data.amount,
      note: data.note,
      recordDate,
      updatedAt: now,
    },
  });
  const updated = await db.collection('salary_advances').doc(id).get();
  return updated.data;
}

async function findBillByMonth(userId, month) {
  await ensureCollections(db, ['salary_bills']);
  const res = await db.collection('salary_bills').where({ userId, month }).limit(1).get();
  return res.data.length > 0 ? res.data[0] : null;
}

async function findBillsByYear(userId, year) {
  await ensureCollections(db, ['salary_bills']);
  const res = await db.collection('salary_bills')
    .where({ userId, month: _.gte(year + '-01').and(_.lte(year + '-12')) })
    .orderBy('month', 'desc')
    .limit(24)
    .get();
  return res.data;
}

async function createBill(userId, data) {
  await ensureCollections(db, ['salary_bills']);
  const now = new Date();
  const billData = {
    userId,
    month: data.month,
    grossSalary: data.grossSalary,
    actualSalary: data.actualSalary,
    totalDeductions: data.totalDeductions,
    totalExpenses: data.totalExpenses,
    totalAdvances: data.totalAdvances,
    remaining: data.remaining,
    isSettled: data.isSettled,
    createdAt: now,
    archivedAt: now,
    updatedAt: now,
  };
  const res = await db.collection('salary_bills').add({ data: billData });
  const created = await db.collection('salary_bills').doc(res._id).get();
  return created.data;
}

async function updateBill(id, data) {
  await ensureCollections(db, ['salary_bills']);
  const now = new Date();
  const billData = {
    month: data.month,
    grossSalary: data.grossSalary,
    actualSalary: data.actualSalary,
    totalDeductions: data.totalDeductions,
    totalExpenses: data.totalExpenses,
    totalAdvances: data.totalAdvances,
    remaining: data.remaining,
    isSettled: data.isSettled,
    updatedAt: now,
  };
  await db.collection('salary_bills').doc(id).update({ data: billData });
  const updated = await db.collection('salary_bills').doc(id).get();
  return updated.data;
}

async function findBoardData(userId, month) {
  await ensureSalaryCollections();
  const [deductionsRes, expensesRes, advancesRes, workhoursRes, billRes] = await Promise.all([
    db.collection('salary_deductions').where({ userId, month }).get(),
    db.collection('salary_expenses').where({ userId, month }).get(),
    db.collection('salary_advances').where({ userId, month }).get(),
    db.collection('workhour_records').where({
      userId,
      recordDate: _.gte(month + '-01').and(_.lte(month + '-31')),
    }).get(),
    db.collection('salary_bills').where({ userId, month }).limit(1).get(),
  ]);

  return {
    deductions: deductionsRes.data,
    expenses: expensesRes.data,
    advances: advancesRes.data,
    workhours: workhoursRes.data,
    bill: billRes.data.length > 0 ? billRes.data[0] : null,
  };
}

module.exports = {
  ensureSalaryCollections,
  findUserByOpenid,
  createDeduction,
  findDeductionsByMonth,
  findDeductionById,
  deleteDeduction,
  updateDeduction,
  createExpense,
  findExpensesByMonth,
  findExpenseById,
  deleteExpense,
  updateExpense,
  createAdvance,
  findAdvancesByMonth,
  findAdvanceById,
  deleteAdvance,
  updateAdvance,
  findBillByMonth,
  findBillsByYear,
  createBill,
  updateBill,
  findBoardData,
};
