// pages/login/login.js
const auth = require('../../utils/auth');
const { apiRequest, toast } = require('../../utils/api');

const TAB_PATHS = [
  '/pages/home/home',
  '/pages/workhours/workhours',
  '/pages/salary/salary',
  '/pages/profile/profile'
];

Page({
  data: {
    agreed: false,
    redirect: '',
    showAgreement: false,
    showPrivacy: false,
    logging: false,
    showUserForm: false,
    nickname: '',
    avatarUrl: '',
    tempToken: null
  },

  onLoad(options) {
    let redirect = options.redirect || '';
    if (redirect) {
      try {
        redirect = decodeURIComponent(redirect);
      } catch (e) {}
    }
    this.setData({ redirect: redirect });
  },

  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed });
  },

  showAgreement() {
    this.setData({ showAgreement: true, showPrivacy: false });
  },

  showPrivacy() {
    this.setData({ showPrivacy: true, showAgreement: false });
  },

  closeAgreementModal() {
    this.setData({ showAgreement: false, showPrivacy: false });
  },

  stopPropagation() {},

  wechatLogin() {
    if (!this.data.agreed) {
      toast('请先阅读并同意用户协议');
      return;
    }
    if (this.data.logging) return;
    this.setData({ logging: true });

    auth.login()
      .then(data => {
        this.setData({ logging: false });
        
        if (data.isNewUser) {
          this.setData({ 
            showUserForm: true,
            tempToken: data.accessToken
          });
        } else {
          this._doLoginSuccess(data);
        }
      })
      .catch((err) => {
        toast(err && err.message ? err.message : '登录失败');
        this.setData({ logging: false });
      });
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({ avatarUrl });
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  submitUserForm() {
    const { nickname, avatarUrl, tempToken } = this.data;
    
    if (!nickname.trim()) {
      toast('请输入昵称');
      return;
    }

    apiRequest('/auth/update-profile', {
      method: 'POST',
      data: { nickname, avatarUrl }
    })
      .then(data => {
        wx.setStorageSync('worker_law_user', data.user);
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.userInfo = data.user;
        }
        this._doLoginSuccess({ user: data.user });
      })
      .catch(err => {
        toast(err.message || '保存失败');
      });
  },

  _doLoginSuccess(data) {
    toast('登录成功', 'success');
    const redirect = this.data.redirect;
    setTimeout(() => {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
      } else if (redirect && TAB_PATHS.indexOf(redirect) >= 0) {
        wx.switchTab({ url: redirect });
      } else if (redirect) {
        wx.redirectTo({ url: redirect });
      } else {
        wx.switchTab({ url: '/pages/home/home' });
      }
    }, 500);
  }
});
