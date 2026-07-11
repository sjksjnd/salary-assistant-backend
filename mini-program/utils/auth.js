const api = require('./api');

function login(profile = {}) {
  return api.login(profile.nickname, profile.avatarUrl);
}

function getUserProfile(desc) {
  return new Promise((resolve, reject) => {
    wx.getUserProfile({
      desc: desc || '用于完善用户资料',
      success(res) {
        resolve(res.userInfo);
      },
      fail() {
        reject(new Error('用户拒绝授权'));
      },
    });
  });
}

function logout() {
  return api.logout();
}

module.exports = {
  login,
  getUserProfile,
  logout,
};
