const config = require('../config');
const { error, ERROR_CODES } = require('../utils/response');
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  logger.error('Server error:', {
    url: req.url,
    method: req.method,
    userId: req.userId,
    error: err.message,
    stack: config.isDev() ? err.stack : undefined,
  });

  if (err.isBusinessError) {
    return res.status(err.httpStatus || 400).json(error(err.code, err.message, err.errors));
  }

  if (err.name === 'ZodError') {
    const errors = err.errors.map(e => ({
      field: e.path.join('.'),
      msg: e.message,
    }));
    return res.status(400).json(error(ERROR_CODES.PARAM_INVALID.code, ERROR_CODES.PARAM_INVALID.message, errors));
  }

  const message = config.isDev() ? err.message : ERROR_CODES.SERVER_ERROR.message;
  res.status(500).json(error(ERROR_CODES.SERVER_ERROR.code, message));
}

function BusinessError(code, message, httpStatus = 400, errors = null) {
  const err = new Error(message);
  err.isBusinessError = true;
  err.code = code;
  err.httpStatus = httpStatus;
  err.errors = errors;
  return err;
}

module.exports = { errorHandler, BusinessError };
