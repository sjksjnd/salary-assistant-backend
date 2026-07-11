function validateConfigKey(key) {
  if (!key) {
    return { valid: false, message: '配置 key 不能为空' };
  }
  return { valid: true };
}

function validateAgreementType(type) {
  if (!type) {
    return { valid: false, message: '协议类型不能为空' };
  }
  return { valid: true };
}

function validateAcceptAgreementParams(event) {
  const { type, version } = event;
  if (!type || !version) {
    return { valid: false, message: '参数不完整' };
  }
  return { valid: true };
}

function formatConfigList(items) {
  const configs = {};
  for (const item of items) {
    configs[item.key] = item.value;
  }
  return configs;
}

function formatAgreement(type, item, fallback) {
  const value = item ? item.value : fallback;
  if (!value) {
    return {
      type,
      version: '1.0',
      title: type === 'privacy' ? '隐私政策' : type === 'user' ? '用户协议' : `${type}协议`,
      content: '协议内容加载中...',
      updatedAt: new Date(),
    };
  }
  return {
    type,
    version: value.version || '1.0',
    title: value.title || '',
    content: value.content || '',
    updatedAt: item ? item.updatedAt : new Date(),
  };
}

module.exports = {
  validateConfigKey,
  validateAgreementType,
  validateAcceptAgreementParams,
  formatConfigList,
  formatAgreement,
};
