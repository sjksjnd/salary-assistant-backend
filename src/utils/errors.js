/**
 * Custom business error class.
 * Carries an application-specific code, HTTP status, and optional field errors
 * so the global error handler can map them to a consistent response shape.
 */
class BusinessError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.status = status;
    this.errors = null;
  }
}

/**
 * Factory: parameter validation error (40001).
 * @param {string} [message] - human-readable message
 * @param {Array|Object|null} [errors] - structured field errors
 * @returns {BusinessError}
 */
function paramError(message = '参数校验失败', errors = null) {
  const err = new BusinessError(40001, message, 400);
  err.errors = errors;
  return err;
}

/**
 * Factory: unauthorized error (40101).
 * @param {string} [message]
 * @returns {BusinessError}
 */
function unauthorized(message = '未登录或 token 过期') {
  return new BusinessError(40101, message, 401);
}

/**
 * Factory: forbidden error (40301).
 * @param {string} [message]
 * @returns {BusinessError}
 */
function forbidden(message = '无权限访问该资源') {
  return new BusinessError(40301, message, 403);
}

/**
 * Factory: not found error (40401).
 * @param {string} [message]
 * @returns {BusinessError}
 */
function notFound(message = '资源不存在') {
  return new BusinessError(40401, message, 404);
}

module.exports = { BusinessError, paramError, unauthorized, forbidden, notFound };
