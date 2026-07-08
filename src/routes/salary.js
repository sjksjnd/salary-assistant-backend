const express = require('express');
const { z } = require('zod');
const router = express.Router();
const salaryService = require('../services/salaryService');
const calcService = require('../services/calcService');
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { monthSchema, dateSchema, amountSchema, nonEmptyString } = require('../middleware/validate');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

// Deduction / expense share the same body shape.
const deductionExpenseSchema = z.object({
  month: monthSchema,
  category: nonEmptyString(50),
  amount: amountSchema,
  note: z.string().max(500).optional().default(''),
  date: dateSchema.optional(),
  recordDate: dateSchema.optional(),
}).refine(d => d.date || d.recordDate, { message: '必须提供 date 或 recordDate' });

const advanceSchema = z.object({
  month: monthSchema,
  amount: amountSchema,
  note: z.string().max(500).optional(),
  purpose: z.string().max(500).optional(),
  date: dateSchema.optional(),
  recordDate: dateSchema.optional(),
});

const billSchema = z.object({
  month: monthSchema,
  grossSalary: z.number().min(0).max(1000000),
  actualSalary: z.number().min(0).max(1000000),
  totalDeductions: z.number().min(0).max(1000000).optional().default(0),
  totalExpenses: z.number().min(0).max(1000000).optional().default(0),
  totalAdvances: z.number().min(0).max(1000000).optional().default(0),
  remaining: z.number().min(-1000000).max(1000000).optional().default(0),
  isSettled: z.boolean().optional().default(false),
});

router.post('/deductions', authenticate, validateBody(deductionExpenseSchema), async (req, res) => {
  try {
    const { month, category, amount, note, date, recordDate } = req.body;
    const finalDate = recordDate || date;
    const deduction = await salaryService.saveDeduction(req.userId, month, category, amount, note, finalDate);
    res.json(success(deduction, '保存成功'));
  } catch (err) {
    logger.error('Salary API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.get('/deductions/:month', authenticate, async (req, res) => {
  try {
    const { month } = req.params;
    const deductions = await salaryService.getDeductionsByMonth(req.userId, month);
    res.json(success(deductions));
  } catch (err) {
    logger.error('Salary API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.delete('/deductions/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await salaryService.deleteDeduction(req.userId, id);
    if (!deleted) return res.status(404).json(error(40401, '记录不存在'));
    res.json(success(null, '删除成功'));
  } catch (err) {
    logger.error('Salary API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.post('/expenses', authenticate, validateBody(deductionExpenseSchema), async (req, res) => {
  try {
    const { month, category, amount, note, date, recordDate } = req.body;
    const finalDate = recordDate || date;
    const expense = await salaryService.saveExpense(req.userId, month, category, amount, note, finalDate);
    res.json(success(expense, '保存成功'));
  } catch (err) {
    logger.error('Salary API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.get('/expenses/:month', authenticate, async (req, res) => {
  try {
    const { month } = req.params;
    const expenses = await salaryService.getExpensesByMonth(req.userId, month);
    res.json(success(expenses));
  } catch (err) {
    logger.error('Salary API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.delete('/expenses/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await salaryService.deleteExpense(req.userId, id);
    if (!deleted) return res.status(404).json(error(40401, '记录不存在'));
    res.json(success(null, '删除成功'));
  } catch (err) {
    logger.error('Salary API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.post('/advances', authenticate, validateBody(advanceSchema), async (req, res) => {
  try {
    const { month, amount, note, purpose, date, recordDate } = req.body;
    const finalNote = note || purpose;
    const finalDate = recordDate || date;
    const advance = await salaryService.saveAdvance(req.userId, month, amount, finalNote, finalDate);
    res.json(success(advance, '保存成功'));
  } catch (err) {
    logger.error('Salary API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.get('/advances/:month', authenticate, async (req, res) => {
  try {
    const { month } = req.params;
    const advances = await salaryService.getAdvancesByMonth(req.userId, month);
    res.json(success(advances));
  } catch (err) {
    logger.error('Salary API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.delete('/advances/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await salaryService.deleteAdvance(req.userId, id);
    if (!deleted) return res.status(404).json(error(40401, '记录不存在'));
    res.json(success(null, '删除成功'));
  } catch (err) {
    logger.error('Salary API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.post('/bill', authenticate, validateBody(billSchema), async (req, res) => {
  try {
    const { month, grossSalary, actualSalary, totalDeductions, totalExpenses, totalAdvances, remaining, isSettled } = req.body;
    const bill = await salaryService.saveBill(req.userId, month, {
      grossSalary, actualSalary, totalDeductions, totalExpenses, totalAdvances, remaining, isSettled
    });
    res.json(success(bill, '保存成功'));
  } catch (err) {
    logger.error('Salary API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.get('/bill/:month', authenticate, async (req, res) => {
  try {
    const { month } = req.params;
    const bill = await salaryService.getBill(req.userId, month);
    if (!bill) return res.status(404).json(error(40401, '账单不存在'));
    // Convert snake_case to camelCase for frontend
    const formattedBill = {
      id: bill.id,
      month: bill.month,
      grossSalary: bill.gross_salary,
      actualSalary: bill.actual_salary,
      netSalary: bill.actual_salary,
      totalDeductions: bill.total_deductions,
      totalExpenses: bill.total_expenses,
      totalAdvances: bill.total_advances,
      remaining: bill.remaining,
      isSettled: bill.is_settled,
      createdAt: bill.created_at,
      updatedAt: bill.updated_at
    };
    res.json(success(formattedBill));
  } catch (err) {
    logger.error('Salary API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.get('/bills/:year', authenticate, async (req, res) => {
  try {
    const { year } = req.params;
    const bills = await salaryService.getBillsByYear(req.userId, year);
    res.json(success(bills));
  } catch (err) {
    logger.error('Salary API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.get('/board/:month', authenticate, async (req, res) => {
  try {
    const { month } = req.params;
    const board = await salaryService.getBillBoard(req.userId, month);
    res.json(success(board));
  } catch (err) {
    logger.error('Salary API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.post('/calculate', authenticate, async (req, res) => {
  try {
    const result = await calcService.calcFinalPay(req.body);
    res.json(success(result));
  } catch (err) {
    logger.error('Salary API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

module.exports = router;
