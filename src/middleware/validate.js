const { z } = require('zod');

/**
 * Validate request body against a zod schema.
 * On failure, throws a ZodError which is handled by the centralized errorHandler.
 * @param {import('zod').ZodSchema} schema
 * @returns Express middleware
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      // Re-throw as ZodError so errorHandler can format it consistently.
      const err = result.error;
      err.name = 'ZodError';
      return next(err);
    }
    // Replace req.body with the parsed (and coerced/transformed) values.
    req.body = result.data;
    next();
  };
}

/**
 * Validate request query against a zod schema.
 * @param {import('zod').ZodSchema} schema
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const err = result.error;
      err.name = 'ZodError';
      return next(err);
    }
    req.query = result.data;
    next();
  };
}

// ---- Reusable schema fragments ----

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, '月份格式应为 YYYY-MM');

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD');

// Amount in CNY: positive number, max 200000 (matches frontend AMOUNT_MAX).
const amountSchema = z.number().positive().max(200000, '金额不能超过 200000 元');

// Hours: 0.5 ~ 24, multiple of 0.5.
const hoursSchema = z.number().min(0.5, '工时至少 0.5').max(24, '工时不能超过 24');

const shiftSchema = z.enum(['day', 'night', '白班', '夜班']).optional().default('day');

// Generic non-empty trimmed string with max length.
const nonEmptyString = (max = 200) =>
  z.string().trim().min(1, '不能为空').max(max, `长度不能超过 ${max} 个字符`);

module.exports = {
  validateBody,
  validateQuery,
  // Reusable schemas
  monthSchema,
  dateSchema,
  amountSchema,
  hoursSchema,
  shiftSchema,
  nonEmptyString,
};
