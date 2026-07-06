const express = require('express');
const router = express.Router();
const salaryService = require('../services/salaryService');
const calcService = require('../services/calcService');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');

router.post('/deductions', authenticate, async (req, res) => {
  try {
    const { month, category, amount, note, recordDate } = req.body;
    if (!month || !category || amount === undefined) {
      return res.status(400).json(error(40001, '参数错误'));
    }
    const deduction = await salaryService.saveDeduction(req.userId, month, category, amount, note, recordDate);
    res.json(success(deduction, '保存成功'));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.get('/deductions/:month', authenticate, async (req, res) => {
  try {
    const { month } = req.params;
    const deductions = await salaryService.getDeductionsByMonth(req.userId, month);
    res.json(success(deductions));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.delete('/deductions/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await salaryService.deleteDeduction(req.userId, id);
    if (!deleted) return res.status(404).json(error(40401, '记录不存在'));
    res.json(success(null, '删除成功'));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.post('/expenses', authenticate, async (req, res) => {
  try {
    const { month, category, amount, note, recordDate } = req.body;
    if (!month || !category || amount === undefined) {
      return res.status(400).json(error(40001, '参数错误'));
    }
    const expense = await salaryService.saveExpense(req.userId, month, category, amount, note, recordDate);
    res.json(success(expense, '保存成功'));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.get('/expenses/:month', authenticate, async (req, res) => {
  try {
    const { month } = req.params;
    const expenses = await salaryService.getExpensesByMonth(req.userId, month);
    res.json(success(expenses));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.delete('/expenses/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await salaryService.deleteExpense(req.userId, id);
    if (!deleted) return res.status(404).json(error(40401, '记录不存在'));
    res.json(success(null, '删除成功'));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.post('/advances', authenticate, async (req, res) => {
  try {
    const { month, amount, note, recordDate } = req.body;
    if (!month || amount === undefined) {
      return res.status(400).json(error(40001, '参数错误'));
    }
    const advance = await salaryService.saveAdvance(req.userId, month, amount, note, recordDate);
    res.json(success(advance, '保存成功'));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.get('/advances/:month', authenticate, async (req, res) => {
  try {
    const { month } = req.params;
    const advances = await salaryService.getAdvancesByMonth(req.userId, month);
    res.json(success(advances));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.delete('/advances/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await salaryService.deleteAdvance(req.userId, id);
    if (!deleted) return res.status(404).json(error(40401, '记录不存在'));
    res.json(success(null, '删除成功'));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.post('/bill', authenticate, async (req, res) => {
  try {
    const { month, grossSalary, actualSalary, totalDeductions, totalExpenses, totalAdvances, remaining, isSettled } = req.body;
    if (!month || grossSalary === undefined || actualSalary === undefined) {
      return res.status(400).json(error(40001, '参数错误'));
    }
    const bill = await salaryService.saveBill(req.userId, month, {
      grossSalary, actualSalary, totalDeductions, totalExpenses, totalAdvances, remaining, isSettled
    });
    res.json(success(bill, '保存成功'));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.get('/bill/:month', authenticate, async (req, res) => {
  try {
    const { month } = req.params;
    const bill = await salaryService.getBill(req.userId, month);
    if (!bill) return res.status(404).json(error(40401, '账单不存在'));
    res.json(success(bill));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.get('/bills/:year', authenticate, async (req, res) => {
  try {
    const { year } = req.params;
    const bills = await salaryService.getBillsByYear(req.userId, year);
    res.json(success(bills));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.get('/board/:month', authenticate, async (req, res) => {
  try {
    const { month } = req.params;
    const board = await salaryService.getBillBoard(req.userId, month);
    res.json(success(board));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.post('/calculate', authenticate, async (req, res) => {
  try {
    const result = await calcService.calcFinalPay(req.body);
    res.json(success(result));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

module.exports = router;
