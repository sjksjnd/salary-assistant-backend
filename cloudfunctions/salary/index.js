const cloud = require('wx-server-sdk');
const service = require('./service');
const repo = require('./repository');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function ok(data = null, message = 'success') {
  return { code: 0, message, data };
}

function fail(code, message, data = null) {
  return { code, message, data };
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const action = event.action;

  try {
    const user = await repo.findUserByOpenid(openid);
    if (!user) return fail(40101, '用户不存在');
    const userId = user._id;

    switch (action) {
      case 'saveDeduction':
        return await saveDeduction(userId, event);
      case 'getDeductions':
        return await getDeductions(userId, event.month);
      case 'deleteDeduction':
        return await deleteDeduction(userId, event.id);
      case 'saveExpense':
        return await saveExpense(userId, event);
      case 'getExpenses':
        return await getExpenses(userId, event.month);
      case 'deleteExpense':
        return await deleteExpense(userId, event.id);
      case 'saveAdvance':
        return await saveAdvance(userId, event);
      case 'getAdvances':
        return await getAdvances(userId, event.month);
      case 'deleteAdvance':
        return await deleteAdvance(userId, event.id);
      case 'saveBill':
        return await saveBill(userId, event);
      case 'getBill':
        return await getBill(userId, event.month);
      case 'getBills':
        return await getBills(userId, event.year);
      case 'getBoard':
        return await getBoard(userId, event.month);
      default:
        return fail(40001, '未知操作');
    }
  } catch (err) {
    console.error('[salary error]', action, err);
    return fail(50001, '服务器内部错误');
  }
};

async function saveDeduction(userId, event) {
  const { month, category, amount, note, recordDate } = service.normalizeDeductionInput(event);

  const monthValidation = service.validateMonth(month);
  if (!monthValidation.valid) return fail(40001, monthValidation.message);

  const categoryValidation = service.validateCategory(category);
  if (!categoryValidation.valid) return fail(40001, categoryValidation.message);

  const amountValidation = service.validateAmount(amount);
  if (!amountValidation.valid) return fail(40001, amountValidation.message);

  const created = await repo.createDeduction(userId, {
    month,
    category,
    amount: amountValidation.amount,
    note,
    recordDate,
  });
  return ok(service.formatDeduction(created), '保存成功');
}

async function getDeductions(userId, month) {
  const monthValidation = service.validateMonth(month);
  if (!monthValidation.valid) return fail(40001, monthValidation.message);

  const records = await repo.findDeductionsByMonth(userId, month);
  return ok(records.map(service.formatDeduction));
}

async function deleteDeduction(userId, id) {
  const record = await repo.findDeductionById(id);
  if (!record || record.userId !== userId) return fail(40401, '记录不存在');

  await repo.deleteDeduction(id);
  return ok(null, '删除成功');
}

async function saveExpense(userId, event) {
  const { month, category, amount, note, recordDate } = service.normalizeExpenseInput(event);

  const monthValidation = service.validateMonth(month);
  if (!monthValidation.valid) return fail(40001, monthValidation.message);

  const categoryValidation = service.validateCategory(category);
  if (!categoryValidation.valid) return fail(40001, categoryValidation.message);

  const amountValidation = service.validateAmount(amount);
  if (!amountValidation.valid) return fail(40001, amountValidation.message);

  const created = await repo.createExpense(userId, {
    month,
    category,
    amount: amountValidation.amount,
    note,
    recordDate,
  });
  return ok(service.formatExpense(created), '保存成功');
}

async function getExpenses(userId, month) {
  const monthValidation = service.validateMonth(month);
  if (!monthValidation.valid) return fail(40001, monthValidation.message);

  const records = await repo.findExpensesByMonth(userId, month);
  return ok(records.map(service.formatExpense));
}

async function deleteExpense(userId, id) {
  const record = await repo.findExpenseById(id);
  if (!record || record.userId !== userId) return fail(40401, '记录不存在');

  await repo.deleteExpense(id);
  return ok(null, '删除成功');
}

async function saveAdvance(userId, event) {
  const { month, amount, note, recordDate } = service.normalizeAdvanceInput(event);

  const monthValidation = service.validateMonth(month);
  if (!monthValidation.valid) return fail(40001, monthValidation.message);

  const amountValidation = service.validateAmount(amount);
  if (!amountValidation.valid) return fail(40001, amountValidation.message);

  const created = await repo.createAdvance(userId, {
    month,
    amount: amountValidation.amount,
    note,
    recordDate,
  });
  return ok(service.formatAdvance(created), '保存成功');
}

async function getAdvances(userId, month) {
  const monthValidation = service.validateMonth(month);
  if (!monthValidation.valid) return fail(40001, monthValidation.message);

  const records = await repo.findAdvancesByMonth(userId, month);
  return ok(records.map(service.formatAdvance));
}

async function deleteAdvance(userId, id) {
  const record = await repo.findAdvanceById(id);
  if (!record || record.userId !== userId) return fail(40401, '记录不存在');

  await repo.deleteAdvance(id);
  return ok(null, '删除成功');
}

async function saveBill(userId, event) {
  const billData = service.normalizeBillInput(event);

  const monthValidation = service.validateMonth(billData.month);
  if (!monthValidation.valid) return fail(40001, monthValidation.message);

  const existing = await repo.findBillByMonth(userId, billData.month);

  if (existing) {
    const updated = await repo.updateBill(existing._id, billData);
    return ok(service.formatBill(updated), '保存成功');
  } else {
    const created = await repo.createBill(userId, billData);
    return ok(service.formatBill(created), '保存成功');
  }
}

async function getBill(userId, month) {
  const monthValidation = service.validateMonth(month);
  if (!monthValidation.valid) return fail(40001, monthValidation.message);

  const bill = await repo.findBillByMonth(userId, month);
  if (!bill) return fail(40401, '账单不存在');
  return ok(service.formatBill(bill));
}

async function getBills(userId, year) {
  const yearValidation = service.validateYear(year);
  if (!yearValidation.valid) return fail(40001, yearValidation.message);

  const bills = await repo.findBillsByYear(userId, year);
  return ok(bills.map(service.formatBill));
}

async function getBoard(userId, month) {
  const monthValidation = service.validateMonth(month);
  if (!monthValidation.valid) return fail(40001, monthValidation.message);

  const { deductions, expenses, advances, workhours, bill } = await repo.findBoardData(userId, month);
  const boardData = service.calculateBoardData(deductions, expenses, advances, workhours, bill);

  return ok({
    month,
    ...boardData,
  });
}
