App({
  globalData: {
    userInfo: null,
    fontScale: 'medium',
    cloudReady: false,
  },

  onLaunch() {
    const cloudReady = this._initCloud();
    this._loadStoredAuth();
    if (cloudReady) {
      this._initCloudData();
    }
  },

  _initCloud() {
    if (this.globalData.cloudReady) return true;
    try {
      wx.cloud.init({
        env: 'cloud1-d5gejhgdz27493ea6',
        traceUser: true,
      });
      this.globalData.cloudReady = true;
      return true;
    } catch (e) {
      console.error('云开发初始化失败:', e);
      this.globalData.cloudReady = false;
      return false;
    }
  },

  _loadStoredAuth() {
    try {
      const userInfo = wx.getStorageSync('worker_law_user');
      const fontScale = wx.getStorageSync('yunke_font_scale');

      if (userInfo) this.globalData.userInfo = userInfo;
      if (fontScale) this.globalData.fontScale = fontScale;
    } catch (e) {
      console.warn('Failed to load stored auth:', e);
    }
  },

  _initCloudData() {
    const initKey = 'salary_assistant_cloud_init_v2';
    try {
      if (wx.getStorageSync(initKey)) return;
    } catch (e) {}

    wx.cloud.callFunction({
      name: 'seedData',
      data: { action: 'initAll' },
      success: () => {
        try {
          wx.setStorageSync(initKey, true);
        } catch (e) {}
      },
      fail: err => {
        console.warn('Cloud data init skipped:', err);
      },
    });
  },

  isLoggedIn() {
    return !!this.globalData.userInfo;
  },

  requireLogin(redirect) {
    if (!this.isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent(redirect || '') });
      return false;
    }
    return true;
  },
});
