/**
 * Authentication helper.
 */
const { apiRequest, toast } = require('./api');

/**
 * WeChat login flow:
 * 1. wx.login() to get code
 * 2. POST /auth/login with code
 * 3. Save token and user info
 */
function login() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(loginRes) {
        if (!loginRes.code) {
          reject(new Error('微信登录失败：未获取到 code'));
          return;
        }
        apiRequest('/auth/login', {
          method: 'POST',
          data: { code: loginRes.code }
        })
          .then(data => {
            if (data && data.accessToken && data.user) {
              wx.setStorageSync('worker_law_token', data.accessToken);
              wx.setStorageSync('worker_law_user', data.user);
              const app = getApp();
              if (app && app.globalData) {
                app.globalData.token = data.accessToken;
                app.globalData.userInfo = data.user;
              }
              resolve(data);
            } else {
              reject(new Error('登录响应格式错误'));
            }
          })
          .catch(reject);
      },
      fail(err) {
        reject(new Error('微信登录失败：' + (err.errMsg || '未知错误')));
      }
    });
  });
}

/**
 * Get user profile (nickname + avatar) via wx.getUserProfile.
 * Must be triggered by a user action (e.g. button tap).
 */
function getUserProfile(desc) {
  return new Promise((resolve, reject) => {
    wx.getUserProfile({
      desc: desc || '用于完善用户资料',
      success(res) {
        resolve(res.userInfo);
      },
      fail(err) {
        reject(new Error('用户拒绝授权'));
      }
    });
  });
}

/**
 * Logout: clear local storage and global state.
 */
function logout() {
  try {
    wx.removeStorageSync('worker_law_token');
    wx.removeStorageSync('worker_law_user');
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.token = null;
      app.globalData.userInfo = null;
    }
  } catch (e) {}
}

module.exports = {
  login,
  getUserProfile,
  logout
};
