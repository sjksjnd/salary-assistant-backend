// pages/profile/profile.js
const { toast, apiRequest } = require('../../utils/api');
const auth = require('../../utils/auth');
const storage = require('../../utils/storage');

const app = getApp();

function fontScaleClass(scale) {
  switch (scale) {
    case 'large': return 'font-scale-large';
    case 'extra-large': return 'font-scale-extra-large';
    case 'small': return 'font-scale-small';
    default: return '';
  }
}

function formatBackupDate(date) {
  const pad = n => String(n).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + '_' + [pad(date.getHours()), pad(date.getMinutes())].join('-');
}

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    settingsExpanded: false,
    fontScale: 'medium',
    fontScaleClass: '',
    defaultShift: 'day',
    notifyEnabled: false,
    notifyTime: '09:00'
  },

  onLoad() {
    this._loadSettings();
  },

  onShow() {
    this._refreshLoginState();
    if (app.isLoggedIn()) {
      this._fetchRemoteSettings();
    }
  },

  _loadSettings() {
    const fontScale = storage.get('font_scale', 'medium') || 'medium';
    const defaultShift = this._normalizeShift(storage.get('default_shift', 'day'));
    const notifyEnabled = storage.get('notify_enabled', false);
    const notifyTime = storage.get('notify_time', '09:00');
    app.globalData.fontScale = fontScale;
    this.setData({
      fontScale,
      fontScaleClass: fontScaleClass(fontScale),
      defaultShift,
      notifyEnabled,
      notifyTime
    });
  },

  _fetchRemoteSettings() {
    apiRequest('/users/settings', { method: 'GET' })
      .then(data => {
        if (!data) return;
        const updates = {};
        if (data.fontScale) {
          updates.fontScale = data.fontScale;
          updates.fontScaleClass = fontScaleClass(data.fontScale);
          app.globalData.fontScale = data.fontScale;
          storage.set('font_scale', data.fontScale);
        }
        const remoteNotifyEnabled = data.notifyEnabled !== undefined ? data.notifyEnabled : data.reminderEnabled;
        const remoteNotifyTime = data.notifyTime || data.reminderTime;
        if (remoteNotifyEnabled !== undefined) {
          updates.notifyEnabled = !!remoteNotifyEnabled;
          storage.set('notify_enabled', !!remoteNotifyEnabled);
        }
        if (remoteNotifyTime) {
          updates.notifyTime = remoteNotifyTime;
          storage.set('notify_time', remoteNotifyTime);
        }
        if (Object.keys(updates).length > 0) {
          this.setData(updates);
        }
      })
      .catch(() => {});
  },

  _normalizeShift(value) {
    if (value === 'night' || value === '夜班') return 'night';
    return 'day';
  },

  _syncSettingToBackend(key, value) {
    if (!app.isLoggedIn()) return;
    const remoteKeyMap = {
      notifyEnabled: 'reminderEnabled',
      notifyTime: 'reminderTime'
    };
    const remoteKey = remoteKeyMap[key] || key;
    apiRequest('/users/settings', {
      method: 'PUT',
      data: { [remoteKey]: value }
    }).catch(() => {});
  },

  _refreshLoginState() {
    const userInfo = app.globalData.userInfo;
    this.setData({
      isLoggedIn: app.isLoggedIn(),
      userInfo
    });
  },

  onUserCardTap() {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({
        url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/profile/profile')
      });
      return;
    }
    wx.showActionSheet({
      itemList: ['更换头像', '修改昵称'],
      success: res => {
        if (res.tapIndex === 0) this.editAvatar();
        if (res.tapIndex === 1) this.editNickname();
      }
    });
  },

  editAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: res => {
        const tempFilePath = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath;
        if (tempFilePath) this._uploadAvatarToCloud(tempFilePath);
      }
    });
  },

  _uploadAvatarToCloud(tempFilePath) {
    wx.showLoading({ title: '上传中...' });
    const cloudReady = app && app._initCloud ? app._initCloud() : false;
    if (!cloudReady) {
      wx.hideLoading();
      toast('头像上传准备失败，请稍后重试');
      return;
    }

    const cloudPath = 'avatars/' + Date.now() + '-' + Math.random().toString(36).substring(2, 8) + '.jpg';
    wx.cloud.uploadFile({
      cloudPath,
      filePath: tempFilePath,
      success: uploadRes => {
        wx.cloud.getTempFileURL({
          fileList: [uploadRes.fileID],
          success: urlRes => {
            const file = urlRes.fileList && urlRes.fileList[0];
            this._sendAvatarUrl((file && file.tempFileURL) || uploadRes.fileID);
          },
          fail: () => this._sendAvatarUrl(uploadRes.fileID)
        });
      },
      fail: () => {
        wx.hideLoading();
        toast('头像上传失败，请稍后重试');
      }
    });
  },

  _sendAvatarUrl(avatarUrl) {
    apiRequest('/auth/avatar', {
      method: 'POST',
      data: { avatarUrl }
    })
      .then(data => {
        wx.hideLoading();
        const userInfo = Object.assign({}, this.data.userInfo, {
          avatarUrl: (data && data.avatarUrl) || avatarUrl
        });
        this.setData({ userInfo });
        app.globalData.userInfo = userInfo;
        wx.setStorageSync('worker_law_user', userInfo);
        toast('头像已更新', 'success');
      })
      .catch(err => {
        wx.hideLoading();
        toast(err.message || '头像保存失败');
      });
  },

  editNickname() {
    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: '请输入新昵称',
      content: this.data.userInfo ? this.data.userInfo.nickname || '' : '',
      success: res => {
        if (!res.confirm) return;
        const nickname = (res.content || '').trim();
        if (!nickname) {
          toast('昵称不能为空');
          return;
        }
        if (nickname.length > 20) {
          toast('昵称最多20个字');
          return;
        }
        this._updateNickname(nickname);
      }
    });
  },

  _updateNickname(nickname) {
    apiRequest('/auth/profile', {
      method: 'PUT',
      data: { nickname }
    })
      .then(() => {
        const userInfo = Object.assign({}, this.data.userInfo, { nickname });
        this.setData({ userInfo });
        app.globalData.userInfo = userInfo;
        wx.setStorageSync('worker_law_user', userInfo);
        toast('昵称已更新', 'success');
      })
      .catch(err => toast(err.message || '修改失败'));
  },

  goContractRecords() {
    if (!app.requireLogin('/pages/profile/profile')) return;
    wx.navigateTo({ url: '/pages/records/records' });
  },

  goSalaryRecords() {
    if (!app.requireLogin('/pages/profile/profile')) return;
    wx.switchTab({ url: '/pages/salary/salary' });
  },

  toggleSettings() {
    this.setData({ settingsExpanded: !this.data.settingsExpanded });
  },

  onFontScaleChange(e) {
    const scale = e.currentTarget.dataset.scale;
    app.globalData.fontScale = scale;
    storage.set('font_scale', scale);
    this.setData({
      fontScale: scale,
      fontScaleClass: fontScaleClass(scale)
    });
    this._syncSettingToBackend('fontScale', scale);
    toast('字体大小已更新', 'success');
  },

  onShiftChange(e) {
    const shift = e.currentTarget.dataset.shift;
    this.setData({ defaultShift: shift });
    storage.set('default_shift', shift);
    this._syncSettingToBackend('defaultShift', shift);
  },

  onNotifyChange(e) {
    const enabled = e.detail.value;
    this.setData({ notifyEnabled: enabled });
    storage.set('notify_enabled', enabled);
    this._syncSettingToBackend('notifyEnabled', enabled);
  },

  onNotifyTimeChange(e) {
    const time = e.detail.value;
    this.setData({ notifyTime: time });
    storage.set('notify_time', time);
    this._syncSettingToBackend('notifyTime', time);
  },

  backupData() {
    if (app.isLoggedIn()) {
      this.exportAccountData();
      return;
    }
    this.exportLocalData();
  },

  exportAccountData() {
    wx.showLoading({ title: '导出中...' });
    apiRequest('/users/export', { method: 'GET' })
      .then(data => {
        wx.hideLoading();
        this.writeBackupFile(data || {}, '账号数据');
      })
      .catch(err => {
        wx.hideLoading();
        toast(err.message || '导出失败');
      });
  },

  exportLocalData() {
    const now = new Date();
    const allData = {};
    ['worker_law_user'].forEach(key => {
      const value = wx.getStorageSync(key);
      if (value !== '' && value !== null && value !== undefined) allData[key] = value;
    });
    ['font_scale', 'default_shift', 'notify_enabled', 'notify_time'].forEach(key => {
      const value = storage.get(key);
      if (value !== '' && value !== null && value !== undefined) allData[key] = value;
    });

    this.writeBackupFile({
      app: '工友守护-薪工记',
      version: '1.0.0',
      backupTime: now.toISOString(),
      data: allData
    }, '本机缓存');
  },

  writeBackupFile(payload, label) {
    const now = new Date();
    const fileName = '工友守护薪工记_' + label + '_' + formatBackupDate(now) + '.json';
    const jsonStr = JSON.stringify(payload, null, 2);
    wx.showModal({
      title: '数据备份',
      content: '即将生成 ' + label + ' 备份文件',
      confirmText: '确认备份',
      success: res => {
        if (!res.confirm) return;
        wx.getFileSystemManager().writeFile({
          filePath: wx.env.USER_DATA_PATH + '/' + fileName,
          data: jsonStr,
          encoding: 'utf8',
          success: () => wx.showModal({
            title: '备份成功',
            content: '备份文件已保存：' + fileName,
            showCancel: false
          }),
          fail: err => toast('备份失败：' + (err.message || '未知错误'))
        });
      }
    });
  },

  restoreData() {
    wx.showModal({
      title: '数据恢复',
      content: '请妥善保留导出的备份文件。如需恢复，可联系产品支持协助处理。',
      showCancel: false
    });
  },

  clearData() {
    wx.showModal({
      title: '清除本机缓存',
      content: '只会清除当前设备上的登录状态和偏好设置，不会删除云端工时、工资和记录。',
      confirmColor: '#E53935',
      confirmText: '清除',
      success: res => {
        if (!res.confirm) return;
        storage.clearAll();
        app.globalData.userInfo = null;
        app.globalData.fontScale = 'medium';
        this.setData({
          isLoggedIn: false,
          userInfo: null,
          defaultShift: 'day',
          notifyEnabled: false,
          notifyTime: '09:00',
          fontScale: 'medium',
          fontScaleClass: '',
          settingsExpanded: false
        });
        toast('已清除所有数据', 'success');
      }
    });
  },

  deleteCloudData() {
    if (!app.requireLogin('/pages/profile/profile')) return;
    wx.showModal({
      title: '删除云端账号数据',
      content: '将删除云端保存的工时、工资账本、检测记录、设置和账号资料。建议先导出账号数据。',
      confirmColor: '#E53935',
      confirmText: '继续',
      success: first => {
        if (!first.confirm) return;
        wx.showModal({
          title: '再次确认',
          content: '删除后无法恢复。确定继续删除云端账号数据吗？',
          confirmColor: '#E53935',
          confirmText: '删除',
          success: second => {
            if (!second.confirm) return;
            this._deleteCloudDataNow();
          }
        });
      }
    });
  },

  _deleteCloudDataNow() {
    wx.showLoading({ title: '删除中...' });
    apiRequest('/users/data', { method: 'DELETE' })
      .then(() => {
        wx.hideLoading();
        storage.clearAll();
        app.globalData.userInfo = null;
        app.globalData.fontScale = 'medium';
        this.setData({
          isLoggedIn: false,
          userInfo: null,
          defaultShift: 'day',
          notifyEnabled: false,
          notifyTime: '09:00',
          fontScale: 'medium',
          fontScaleClass: '',
          settingsExpanded: false
        });
        wx.showModal({
          title: '已删除',
          content: '云端账号数据已删除，本机缓存也已清除。',
          showCancel: false
        });
      })
      .catch(err => {
        wx.hideLoading();
        toast(err.message || '删除失败，请稍后重试');
      });
  },

  showAbout() {
    wx.showModal({
      title: '关于薪工记',
      content: '工友守护·薪工记用于记录工时工资、管理账本、合同条款自查和常见规则信息整理。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  doLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      confirmText: '退出',
      success: res => {
        if (!res.confirm) return;
        auth.logout();
        this._refreshLoginState();
        toast('已退出登录', 'success');
      }
    });
  }
});
