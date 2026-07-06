/**
 * Unified API response helper
 */

function success(data, message = 'ok') {
  return { code: 0, message, data };
}

function error(code, message, errors = null) {
  const body = { code, message, data: null };
  if (errors) body.errors = errors;
  return body;
}

// Error code constants
const ERROR_CODES = {
  PARAM_INVALID: { code: 40001, message: '参数校验失败' },
  UNAUTHORIZED: { code: 40101, message: '未登录或 token 过期' },
  FORBIDDEN: { code: 40301, message: '无权限访问该资源' },
  NOT_FOUND: { code: 40401, message: '资源不存在' },
  RATE_LIMITED: { code: 42901, message: '请求过于频繁，请稍后重试' },
  SERVER_ERROR: { code: 50001, message: '服务器内部错误' },
  CONTENT_UNSAFE: { code: 40302, message: '内容含敏感信息，请修改后重试' },
};

module.exports = { success, error, ERROR_CODES };
