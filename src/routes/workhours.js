const express = require('express');
const { z } = require('zod');
const router = express.Router();
const workhourService = require('../services/workhourService');
const calcService = require('../services/calcService');
const userService = require('../services/userService');
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { dateSchema, hoursSchema, shiftSchema, amountSchema } = require('../middleware/validate');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

// Schema for POST /workhours - accepts both frontend (date) and backend (recordDate) field names.
const workhourBodySchema = z.object({
  date: dateSchema.optional(),
  recordDate: dateSchema.optional(),
  hours: hoursSchema,
  shift: shiftSchema,
  payAmount: amountSchema.optional(),
  wage: amountSchema.optional(),
}).refine(d => d.date || d.recordDate, { message: '必须提供 date 或 recordDate' });

// Schema for POST /workhours/batch
const batchBodySchema = z.object({
  records: z.array(workhourBodySchema).min(1, '记录不能为空').max(100, '单次最多 100 条'),
});

router.post('/', authenticate, validateBody(workhourBodySchema), async (req, res) => {
  try {
    // After zod validation, normalize field names.
    const recordDate = req.body.recordDate || req.body.date;
    const hours = req.body.hours;
    const shift = req.body.shift === '白班' ? 'day' : req.body.shift === '夜班' ? 'night' : (req.body.shift || 'day');
    const payAmount = req.body.payAmount || req.body.wage;

    const settings = await userService.getUserSettings(req.userId);
    let calculatedPayAmount = payAmount;

    if (!payAmount && settings) {
      calculatedPayAmount = await calcService.calcDailySalary(
        settings.hourly_rate || 25,
        settings.standard_hours || 8,
        hours,
        shift
      );
    }

    const record = await workhourService.saveWorkhour(req.userId, recordDate, hours, shift, calculatedPayAmount);
    // Return camelCase fields for frontend compatibility.
    // NOTE: `payAmount`/`wage` here represent the day's pay amount (pay_amount), NOT hourly rate.
    // Frontend should not use `wage` as hourly rate for statutory wage calculation.
    const formattedRecord = {
      id: record.id,
      date: record.record_date,
      hours: record.hours,
      shift: record.shift === 'night' ? '夜班' : '白班',
      payAmount: record.pay_amount,
      wage: record.pay_amount,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
    res.json(success(formattedRecord, '保存成功'));
  } catch (err) {
    logger.error('Workhours API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.get('/:recordDate', authenticate, async (req, res) => {
  try {
    const { recordDate } = req.params;
    const record = await workhourService.getWorkhour(req.userId, recordDate);
    
    if (!record) {
      return res.status(404).json(error(40401, '记录不存在'));
    }

    res.json(success(record));
  } catch (err) {
    logger.error('Workhours API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.get('/month/:month', authenticate, async (req, res) => {
  try {
    const { month } = req.params;
    const records = await workhourService.getWorkhoursByMonth(req.userId, month);
    const summary = await workhourService.getMonthlySummary(req.userId, month);
    
    // Convert snake_case to camelCase for frontend compatibility
    const formattedRecords = records.map(r => ({
      id: r.id,
      date: r.record_date,
      hours: r.hours,
      shift: r.shift === 'night' ? '夜班' : '白班',
      payAmount: r.pay_amount,
      wage: r.pay_amount,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
    
    res.json(success({ records: formattedRecords, summary }));
  } catch (err) {
    logger.error('Workhours API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.delete('/:recordDate', authenticate, async (req, res) => {
  try {
    const { recordDate } = req.params;
    const deleted = await workhourService.deleteWorkhour(req.userId, recordDate);
    
    if (!deleted) {
      return res.status(404).json(error(40401, '记录不存在'));
    }

    res.json(success(null, '删除成功'));
  } catch (err) {
    logger.error('Workhours API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.post('/batch', authenticate, validateBody(batchBodySchema), async (req, res) => {
  try {
    const results = await workhourService.batchSaveWorkhours(req.userId, req.body.records);
    res.json(success(results, '批量保存成功'));
  } catch (err) {
    logger.error('Workhours API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

module.exports = router;
