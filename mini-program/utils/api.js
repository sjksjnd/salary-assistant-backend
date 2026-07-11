const STORAGE_USER_KEY = 'worker_law_user';

let userCache = null;

function getStoredUser() {
  if (userCache === null) {
    userCache = wx.getStorageSync(STORAGE_USER_KEY) || null;
  }
  return userCache;
}

function setStoredUser(user) {
  userCache = user || null;
  if (userCache) {
    wx.setStorageSync(STORAGE_USER_KEY, userCache);
  } else {
    wx.removeStorageSync(STORAGE_USER_KEY);
  }
}

function syncAppUser(user) {
  const app = getApp();
  if (app && app.globalData) {
    app.globalData.userInfo = user || null;
  }
}

function callFn(name, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success(res) {
        const result = res.result || {};
        if (result.code === 0 || result.code === 200) {
          resolve(result.data);
          return;
        }
        reject(new Error(result.message || '请求失败'));
      },
      fail(err) {
        console.error(`[${name}] call failed:`, err);
        reject(new Error(err.errMsg || '网络异常'));
      },
    });
  });
}

function login(nickname, avatarUrl) {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (!res.code) {
          reject(new Error('获取微信登录凭证失败'));
          return;
        }
        callFn('auth', {
          action: 'login',
          code: res.code,
          nickname,
          avatarUrl,
        })
          .then(data => {
            if (data && data.user) {
              setStoredUser(data.user);
              syncAppUser(data.user);
            }
            resolve(data);
          })
          .catch(reject);
      },
      fail(err) {
        reject(new Error(err.errMsg || '微信登录失败'));
      },
    });
  });
}

function logout() {
  setStoredUser(null);
  syncAppUser(null);
  return callFn('auth', { action: 'logout' }).catch(() => {});
}

function isLoggedIn() {
  return !!getStoredUser();
}

function getCurrentUser() {
  return getStoredUser();
}

function refreshUser() {
  return callFn('auth', { action: 'profile' }).then(user => {
    setStoredUser(user);
    syncAppUser(user);
    return user;
  });
}

const API_MAP = {
  'GET /auth/profile': { name: 'auth', action: 'profile' },
  'PUT /auth/profile': { name: 'users', action: 'updateNickname' },
  'POST /auth/update-profile': { name: 'users', action: 'updateProfile' },
  'POST /auth/avatar': { name: 'users', action: 'updateAvatar' },
  'POST /auth/logout': { name: 'auth', action: 'logout' },
  'GET /users/profile': { name: 'users', action: 'profile' },
  'GET /users/settings': { name: 'users', action: 'getSettings' },
  'PUT /users/settings': { name: 'users', action: 'updateSettings' },
  'POST /users/nickname': { name: 'users', action: 'updateNickname' },
  'POST /users/avatar': { name: 'users', action: 'updateAvatar' },
  'POST /workhours': { name: 'workhours', action: 'save' },
  'POST /workhours/batch': { name: 'workhours', action: 'batch' },
  'DELETE /workhours': { name: 'workhours', action: 'delete' },
  'GET /workhours/month': { name: 'workhours', action: 'month' },
  'POST /salary/deductions': { name: 'salary', action: 'saveDeduction' },
  'GET /salary/deductions': { name: 'salary', action: 'getDeductions' },
  'PUT /salary/deductions': { name: 'salary', action: 'updateDeduction' },
  'DELETE /salary/deductions': { name: 'salary', action: 'deleteDeduction' },
  'POST /salary/expenses': { name: 'salary', action: 'saveExpense' },
  'GET /salary/expenses': { name: 'salary', action: 'getExpenses' },
  'PUT /salary/expenses': { name: 'salary', action: 'updateExpense' },
  'DELETE /salary/expenses': { name: 'salary', action: 'deleteExpense' },
  'POST /salary/advances': { name: 'salary', action: 'saveAdvance' },
  'GET /salary/advances': { name: 'salary', action: 'getAdvances' },
  'PUT /salary/advances': { name: 'salary', action: 'updateAdvance' },
  'DELETE /salary/advances': { name: 'salary', action: 'deleteAdvance' },
  'POST /salary/bill': { name: 'salary', action: 'saveBill' },
  'GET /salary/bill': { name: 'salary', action: 'getBill' },
  'GET /salary/bills': { name: 'salary', action: 'getBills' },
  'GET /salary/board': { name: 'salary', action: 'getBoard' },
  'POST /contract/detect': { name: 'contract', action: 'detect' },
  'POST /contract/analyze': { name: 'contract', action: 'detect' },
  'GET /records': { name: 'contract', action: 'records' },
  'GET /record': { name: 'contract', action: 'recordDetail' },
  'DELETE /record': { name: 'contract', action: 'deleteRecord' },
  'GET /contract/records': { name: 'contract', action: 'records' },
  'GET /contract/record': { name: 'contract', action: 'recordDetail' },
  'DELETE /contract/record': { name: 'contract', action: 'deleteRecord' },
  'GET /compensation/questions': { name: 'compensation', action: 'questions' },
  'POST /compensation/calculate': { name: 'compensation', action: 'calculate' },
  'GET /compensation/items': { name: 'compensation', action: 'getItems' },
  'GET /config': { name: 'config', action: 'get' },
  'GET /config/agreement': { name: 'config', action: 'agreement' },
  'POST /config/acceptAgreement': { name: 'config', action: 'acceptAgreement' },
};

function parsePath(inputPath) {
  const raw = String(inputPath || '');
  const qIndex = raw.indexOf('?');
  const pathname = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const queryString = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
  const query = {};

  if (queryString) {
    queryString.split('&').forEach(pair => {
      if (!pair) return;
      const idx = pair.indexOf('=');
      const key = idx >= 0 ? pair.slice(0, idx) : pair;
      const val = idx >= 0 ? pair.slice(idx + 1) : '';
      if (key) query[decodeURIComponent(key)] = decodeURIComponent(val.replace(/\+/g, ' '));
    });
  }

  return { pathname, query };
}

function normalizeRoute(method, pathname, query) {
  let normalizedPath = pathname;
  const params = Object.assign({}, query);

  let match = pathname.match(/^\/workhours\/month\/([^/]+)$/);
  if (method === 'GET' && match) {
    normalizedPath = '/workhours/month';
    params.month = match[1];
  }

  match = pathname.match(/^\/salary\/(bill|deductions|expenses|advances)\/([^/]+)$/);
  if (method === 'GET' && match) {
    normalizedPath = '/salary/' + match[1];
    params.month = match[2];
  }

  match = pathname.match(/^\/(?:contract\/records|records)\/([^/]+)$/);
  if (match) {
    normalizedPath = pathname.indexOf('/contract/') === 0 ? '/contract/record' : '/record';
    params.id = match[1];
  }

  match = pathname.match(/^\/config\/([^/]+)$/);
  if (method === 'GET' && match) {
    normalizedPath = '/config';
    params.key = match[1];
  }

  return { normalizedPath, params };
}

function normalizePayload(mapping, data) {
  const payload = Object.assign({}, data);

  if (mapping.name === 'contract' && mapping.action === 'detect') {
    payload.content = payload.content || payload.text || '';
    payload.type = payload.type || 'contract';
  }

  if (mapping.name === 'compensation' && mapping.action === 'calculate' && payload.answers) {
    const answers = payload.answers || {};
    const workYears = Number(answers.Q2) || 0;
    payload.type = 'all';
    payload.monthlySalary = Number(answers.Q3) || 0;
    payload.workYears = Math.floor(workYears);
    payload.workMonths = Math.round((workYears - Math.floor(workYears)) * 12);
    payload.isTerminated = answers.Q1 === 'yes';
    payload.hasContract = answers.Q4 !== 'no';
    payload.contractMonths = Math.max(0, Math.round(workYears * 12));
    payload.terminationReason = answers.Q5 === 'forced_termination' ? 'illegal' : 'other';
    payload.noticeGiven = answers.Q5 !== 'company_terminate';
  }

  return payload;
}

function normalizeResponse(mapping, result) {
  if (mapping.name === 'contract' && mapping.action === 'detect') {
    const issues = Array.isArray(result && result.issues) ? result.issues : [];
    const counts = issues.reduce((acc, item) => {
      const severity = item.severity || item.level || 'medium';
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    }, {});

    return {
      summary: {
        total: result && result.totalIssues != null ? result.totalIssues : issues.length,
        totalIssues: result && result.totalIssues != null ? result.totalIssues : issues.length,
        critical: counts.critical || 0,
        high: counts.high || 0,
        medium: counts.medium || 0,
      },
      issues: issues.map(item => ({
        severity: item.severity || item.level || 'medium',
        type: item.type || item.issue || '需核对条款',
        law: item.law || '',
        lawText: item.lawText || '',
        suggestion: item.suggestion || item.issue || '',
      })),
      legalArticles: result && result.legalArticles ? result.legalArticles : [],
    };
  }

  if (mapping.name === 'compensation' && mapping.action === 'calculate') {
    if (result && result.totalAmount !== undefined) return result;
    const details = Array.isArray(result && result.details) ? result.details : [];
    return {
      totalAmount: result && result.total !== undefined ? result.total : 0,
      items: details.map(item => ({
        name: item.item || item.name || '补偿项目',
        amount: item.amount || 0,
        description: item.formula || item.description || '',
        basis: item.basis || '',
        })),
        evidence: [],
        legalArticles: result && result.legalArticles ? result.legalArticles : [],
        disclaimer: result && result.disclaimer,
      };
  }

  if (mapping.name === 'contract' && mapping.action === 'records' && result && Array.isArray(result.items)) {
    return Object.assign({}, result, {
      items: result.items.map(item => ({
        id: item.id,
        type: item.type,
        description: item.description,
        result_text: item.result_text || item.resultText,
        result_detail: item.result_detail || item.resultDetail,
        created_at: item.created_at || item.createdAt,
      })),
    });
  }

  return result;
}

function updateUserProfile(data) {
  const tasks = [];
  if (data.nickname) {
    tasks.push(callFn('users', { action: 'updateNickname', nickname: data.nickname }));
  }
  if (data.avatarUrl) {
    tasks.push(callFn('users', { action: 'updateAvatar', avatarUrl: data.avatarUrl }));
  }
  if (tasks.length === 0) {
    return Promise.reject(new Error('请填写用户资料'));
  }
  return Promise.all(tasks)
    .then(() => callFn('users', { action: 'profile' }))
    .then(user => {
      setStoredUser(user);
      syncAppUser(user);
      return { user };
    });
}

function apiRequest(path, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const parsed = parsePath(path);
  const route = normalizeRoute(method, parsed.pathname, parsed.query);
  const normalizedKey = `${method} ${route.normalizedPath}`;
  const mapping = API_MAP[normalizedKey];

  if (!mapping) {
    return Promise.reject(new Error(`未映射的接口: ${normalizedKey}`));
  }

  const data = normalizePayload(mapping, {
    action: mapping.action,
    ...(route.params || {}),
    ...(opts.params || {}),
    ...(opts.data || {}),
  });

  if (mapping.name === 'users' && mapping.action === 'updateProfile') {
    return updateUserProfile(data);
  }

  return callFn(mapping.name, data).then(result => normalizeResponse(mapping, result));
}

function toast(message, icon = 'none') {
  wx.showToast({ title: message, icon, duration: 1500 });
}

module.exports = {
  callFn,
  login,
  logout,
  isLoggedIn,
  getCurrentUser,
  refreshUser,
  apiRequest,
  toast,
  STORAGE_USER_KEY,
};
