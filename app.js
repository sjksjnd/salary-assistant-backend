App({
  globalData: {
    userInfo: null,
    token: null,
    fontScale: 'medium',
    cloudReady: false
  },
  onLaunch() {
    try {
      wx.cloud.init({
        env: 'prod-d3gnvd30r3101bd5a',
        traceUser: true
      });
      this.globalData.cloudReady = true;
      console.log('云开发初始化成功');
    } catch (e) {
      console.error('云开发初始化失败:', e);
    }

    const token = wx.getStorageSync('worker_law_token');
    const userInfo = wx.getStorageSync('worker_law_user');
    if (token) this.globalData.token = token;
    if (userInfo) this.globalData.userInfo = userInfo;
  },
  // Helper: check if user is logged in
  isLoggedIn() {
    return !!this.globalData.token;
  },
  // Helper: navigate to login page if not logged in
  requireLogin(redirect) {
    if (!this.isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent(redirect || '') });
      return false;
    }
    return true;
  }
});
