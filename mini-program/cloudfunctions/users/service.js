function formatUser(user) {
  return {
    id: user._id,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    phone: user.phone || '',
    points: user.points || 0,
    level: user.level || 1,
    exp: user.exp || 0,
    status: user.status,
    createdAt: user.createdAt,
  };
}

function formatSettings(s) {
  return {
    hourlyRate: s.hourlyRate,
    nightRate: s.nightRate,
    standardHours: s.standardHours,
    factoryName: s.factoryName || '',
    factoryCity: s.factoryCity || '',
    reminderEnabled: s.reminderEnabled,
    reminderTime: s.reminderTime,
    fontScale: s.fontScale,
    defaultShift: s.defaultShift || 'day',
  };
}

function validateNickname(nickname) {
  if (!nickname || !nickname.trim()) {
    return { valid: false, message: '昵称不能为空' };
  }
  if (nickname.length > 50) {
    return { valid: false, message: '昵称不能超过50个字符' };
  }
  return { valid: true };
}

function validateAvatar(avatarUrl) {
  if (!avatarUrl) {
    return { valid: false, message: '头像地址不能为空' };
  }
  return { valid: true };
}

function buildSettingsUpdateData(event) {
  const updateData = { updatedAt: new Date() };
  const validFields = [
    'hourlyRate', 'nightRate', 'standardHours',
    'factoryName', 'factoryCity',
    'reminderEnabled', 'reminderTime',
    'fontScale', 'defaultShift',
  ];

  for (const field of validFields) {
    if (event[field] !== undefined) {
      updateData[field] = event[field];
    }
  }

  return updateData;
}

function validateSettingsUpdate(event) {
  if (event.hourlyRate !== undefined) {
    const rate = Number(event.hourlyRate);
    if (isNaN(rate) || rate <= 0 || rate > 1000) {
      return { valid: false, message: '时薪设置不合理' };
    }
  }

  if (event.standardHours !== undefined) {
    const h = Number(event.standardHours);
    if (isNaN(h) || h < 1 || h > 24) {
      return { valid: false, message: '标准工时设置不合理' };
    }
  }

  if (event.fontScale && !['small', 'medium', 'large', 'extra-large'].includes(event.fontScale)) {
    return { valid: false, message: '字号设置无效' };
  }

  if (event.defaultShift && !['day', 'night'].includes(event.defaultShift)) {
    return { valid: false, message: '默认班次设置无效' };
  }

  return { valid: true };
}

function normalizeSettingsUpdateData(updateData) {
  const result = { ...updateData };
  if (result.hourlyRate !== undefined) {
    result.hourlyRate = Number(result.hourlyRate);
  }
  if (result.standardHours !== undefined) {
    result.standardHours = Number(result.standardHours);
  }
  return result;
}

function sanitizeRecord(item) {
  const result = { ...item };
  delete result.userId;
  delete result.openid;
  return result;
}

function sanitizeList(list) {
  return (list || []).map(sanitizeRecord);
}

function buildExportData(user, data) {
  return {
    exportedAt: new Date().toISOString(),
    profile: formatUser(user),
    settings: sanitizeList(data.user_settings),
    agreements: sanitizeList(data.user_agreements),
    workhours: sanitizeList(data.workhour_records),
    salary: {
      deductions: sanitizeList(data.salary_deductions),
      expenses: sanitizeList(data.salary_expenses),
      advances: sanitizeList(data.salary_advances),
      bills: sanitizeList(data.salary_bills),
    },
    records: sanitizeList(data.detection_records),
    usage: {
      pkulaw: sanitizeList(data.pkulaw_usage),
    },
  };
}

module.exports = {
  formatUser,
  formatSettings,
  validateNickname,
  validateAvatar,
  buildSettingsUpdateData,
  validateSettingsUpdate,
  normalizeSettingsUpdateData,
  buildExportData,
};
