/**
 * API request utility.
 * Uses wx.cloud.callContainer when running inside WeChat Mini Program,
 * falls back to wx.request when in WeH5/preview without container binding.
 */

const API_BASE_URL = 'https://salary-api-278436-5-1450797254.sh.run.tcloudbase.com/api';
const STORAGE_TOKEN_KEY = 'worker_law_token';
const STORAGE_USER_KEY = 'worker_law_user';

const USE_CONTAINER = true;

const CLOUD_ENV = 'prod-d3gnvd30r3101bd5a';
const CLOUD_SERVICE = 'salary-api';

/**
 * Get auth headers with JWT token.
 */
function _authHeaders() {
  const token = wx.getStorageSync(STORAGE_TOKEN_KEY);
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

/**
 * Unified API request. Returns a Promise that resolves with response.data
 * or rejects with an Error.
 *
 * @param {string} path - API path (without /api prefix), e.g. '/contract/analyze'
 * @param {Object} opts - { method, data }
 */
function apiRequest(path, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const header = Object.assign(
    { 'Content-Type': 'application/json' },
    _authHeaders()
  );

  if (USE_CONTAINER) {
    return new Promise((resolve, reject) => {
      wx.cloud.callContainer({
        config: { env: CLOUD_ENV },
        path: '/api' + path,
        method,
        header: Object.assign(header, { 'X-WX-SERVICE': CLOUD_SERVICE }),
        data: opts.data,
        success(res) {
          if (res.statusCode === 401) {
            _clearAuth();
            reject(new Error('登录已过期，请重新登录'));
            return;
          }
          const json = res.data || {};
          if (json.code === 0 || json.code === 200) {
            resolve(json.data);
          } else {
            reject(new Error(json.message || '请求失败'));
          }
        },
        fail(err) {
          console.warn('云调用失败，降级到wx.request:', err);
          _fallbackRequest(path, method, header, opts.data, resolve, reject);
        }
      });
    });
  }

  return _createWxRequest(path, method, header, opts.data);
}

function _fallbackRequest(path, method, header, data, resolve, reject) {
  wx.request({
    url: API_BASE_URL + path,
    method,
    header,
    data,
    success(res) {
      if (res.statusCode === 401) {
        _clearAuth();
        reject(new Error('登录已过期，请重新登录'));
        return;
      }
      if (res.statusCode >= 400) {
        const msg = (res.data && res.data.message) || '请求失败 (' + res.statusCode + ')';
        reject(new Error(msg));
        return;
      }
      const json = res.data || {};
      if (json.code === 0 || json.code === 200) {
        resolve(json.data);
      } else {
        reject(new Error(json.message || '请求失败'));
      }
    },
    fail(err) {
      reject(new Error('网络异常，请检查网络连接'));
    }
  });
}

function _createWxRequest(path, method, header, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: API_BASE_URL + path,
      method,
      header,
      data,
      success(res) {
        if (res.statusCode === 401) {
          _clearAuth();
          reject(new Error('登录已过期，请重新登录'));
          return;
        }
        if (res.statusCode >= 400) {
          const msg = (res.data && res.data.message) || '请求失败 (' + res.statusCode + ')';
          reject(new Error(msg));
          return;
        }
        const json = res.data || {};
        if (json.code === 0 || json.code === 200) {
          resolve(json.data);
        } else {
          reject(new Error(json.message || '请求失败'));
        }
      },
      fail(err) {
        reject(new Error('网络异常，请检查网络连接'));
      }
    });
  });
}

function _clearAuth() {
  try {
    wx.removeStorageSync(STORAGE_TOKEN_KEY);
    wx.removeStorageSync(STORAGE_USER_KEY);
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.token = null;
      app.globalData.userInfo = null;
    }
  } catch (e) {}
}

/**
 * Show a short toast.
 */
function toast(message, icon = 'none') {
  wx.showToast({
    title: message,
    icon,
    duration: 1500
  });
}

module.exports = {
  apiRequest,
  toast,
  API_BASE_URL,
  STORAGE_TOKEN_KEY,
  STORAGE_USER_KEY
};
