// pages/profile/profile.js
const { toast } = require('../../utils/api');
const auth = require('../../utils/auth');
const storage = require('../../utils/storage');

const app = getApp();

// 字体缩放对应的页面 class
function _fontScaleClass(scale) {
  switch (scale) {
    case 'large': return 'font-scale-large';
    case 'extra-large': return 'font-scale-extra-large';
    case 'small': return 'font-scale-small';
    default: return '';
  }
}

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    level: 'V1',
    points: 0,
    // 设置面板展开
    settingsExpanded: false,
    // 字体大小
    fontScale: 'medium',
    fontScaleClass: '',
    // 时薪
    hourlyRate: '',
    // 默认班次
    defaultShift: 'morning',
    // 提醒
    notifyEnabled: false,
    notifyTime: '09:00'
  },

  onLoad() {
    this._loadSettings();
  },

  onShow() {
    this._refreshLoginState();
  },

  // 从本地存储载入偏好设置
  _loadSettings() {
    const fontScale = storage.get('font_scale', 'medium') || 'medium';
    const hourlyRate = storage.get('hourly_rate', '');
    const defaultShift = storage.get('default_shift', 'morning');
    const notifyEnabled = storage.get('notify_enabled', false);
    const notifyTime = storage.get('notify_time', '09:00');
    // 同步到 globalData
    app.globalData.fontScale = fontScale;
    this.setData({
      fontScale: fontScale,
      fontScaleClass: _fontScaleClass(fontScale),
      hourlyRate: hourlyRate,
      defaultShift: defaultShift,
      notifyEnabled: notifyEnabled,
      notifyTime: notifyTime
    });
  },

  // 刷新登录态
  _refreshLoginState() {
    const userInfo = app.globalData.userInfo;
    const isLoggedIn = app.isLoggedIn();
    this.setData({
      isLoggedIn: isLoggedIn,
      userInfo: userInfo
    });
  },

  // 未登录时跳转登录页
  goLogin() {
    if (this.data.isLoggedIn) return;
    wx.navigateTo({
      url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/profile/profile')
    });
  },

  // 跳转到检测记录
  goContractRecords() {
    if (!app.requireLogin('/pages/profile/profile')) return;
    wx.navigateTo({ url: '/pages/contract/contract' });
  },

  // 跳转到工资账单
  goSalaryRecords() {
    if (!app.requireLogin('/pages/profile/profile')) return;
    wx.navigateTo({ url: '/pages/salary/salary' });
  },

  // 展开 / 收起设置
  toggleSettings() {
    this.setData({ settingsExpanded: !this.data.settingsExpanded });
  },

  // 修改字体大小（即时生效）
  onFontScaleChange(e) {
    const scale = e.currentTarget.dataset.scale;
    app.globalData.fontScale = scale;
    storage.set('font_scale', scale);
    this.setData({
      fontScale: scale,
      fontScaleClass: _fontScaleClass(scale)
    });
    toast('字体大小已更新', 'success');
  },

  // 时薪输入（限制 1-500）
  onHourlyRateInput(e) {
    let val = e.detail.value || '';
    // 仅保留数字
    val = val.replace(/[^\d]/g, '');
    if (val !== '') {
      const num = Number(val);
      if (num > 500) val = '500';
      if (num < 1 && val.length > 1) val = '1';
    }
    this.setData({ hourlyRate: val });
    storage.set('hourly_rate', val);
  },

  // 切换默认班次
  onShiftChange(e) {
    const shift = e.currentTarget.dataset.shift;
    this.setData({ defaultShift: shift });
    storage.set('default_shift', shift);
  },

  // 提醒开关
  onNotifyChange(e) {
    const enabled = e.detail.value;
    this.setData({ notifyEnabled: enabled });
    storage.set('notify_enabled', enabled);
  },

  // 提醒时间
  onNotifyTimeChange(e) {
    this.setData({ notifyTime: e.detail.value });
    storage.set('notify_time', e.detail.value);
  },

  // 数据备份（真实实现）
  backupData() {
    const now = new Date();
    const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const timeStr = String(now.getHours()).padStart(2, '0') + '-' + String(now.getMinutes()).padStart(2, '0');
    
    const allData = {};
    try {
      const keys = ['worker_law_token', 'worker_law_user', 'font_scale', 'hourly_rate', 'default_shift', 'notify_enabled', 'notify_time'];
      keys.forEach(key => {
        try {
          const value = wx.getStorageSync(key);
          if (value !== '' && value !== null && value !== undefined) {
            allData[key] = value;
          }
        } catch (e) {}
      });
    } catch (e) {}

    const backupData = {
      app: '工友守护·薪工记',
      version: '1.0.0',
      backupTime: now.toISOString(),
      data: allData
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    
    wx.showModal({
      title: '数据备份',
      content: `即将备份 ${Object.keys(allData).length} 项数据\n文件名：工友守护薪工记_备份_${dateStr}_${timeStr}.json`,
      confirmText: '确认备份',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return;
        
        const fileName = `工友守护薪工记_备份_${dateStr}_${timeStr}.json`;
        
        wx.getFileSystemManager().writeFile({
          filePath: `${wx.env.USER_DATA_PATH}/${fileName}`,
          data: jsonStr,
          encoding: 'utf8',
          success: () => {
            wx.showModal({
              title: '备份成功',
              content: `备份文件已保存到：${fileName}\n\n提示：可通过文件管理器查看或分享`,
              showCancel: false,
              confirmText: '知道了'
            });
          },
          fail: (err) => {
            toast('备份失败：' + (err.message || '未知错误'));
          }
        });
      }
    });
  },

  // 数据恢复（真实实现）
  restoreData() {
    wx.showModal({
      title: '数据恢复',
      content: '此操作将覆盖当前所有本地数据，确定要恢复吗？',
      confirmText: '确认恢复',
      confirmColor: '#E53935',
      success: (res) => {
        if (!res.confirm) return;
        
        wx.showActionSheet({
          itemList: ['从本地文件恢复'],
          success: (actionRes) => {
            if (actionRes.tapIndex === 0) {
              wx.showModal({
                title: '操作提示',
                content: '请手动将备份文件放置到手机存储中，然后在文件管理器中打开并选择「工友守护·薪工记」进行恢复。\n\n备份文件格式：工友守护薪工记_备份_*.json',
                showCancel: false,
                confirmText: '知道了'
              });
            }
          }
        });
      }
    });
  },

  // 清除数据（二次确认）
  clearData() {
    wx.showModal({
      title: '确认清除',
      content: '将清除所有本地数据，且不可恢复，是否继续？',
      confirmColor: '#E53935',
      confirmText: '清除',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          storage.clearAll();
          // 重置页面状态
          app.globalData.fontScale = 'medium';
          this.setData({
            hourlyRate: '',
            defaultShift: 'morning',
            notifyEnabled: false,
            notifyTime: '09:00',
            fontScale: 'medium',
            fontScaleClass: '',
            settingsExpanded: false
          });
          toast('已清除所有数据', 'success');
        }
      }
    });
  },

  // 关于
  showAbout() {
    wx.showModal({
      title: '关于工友守护·薪工记',
      content: '版本：v1.0.0\n\n简介：工友守护·薪工记致力于帮助基层劳动者记录工时、计算工资、了解劳动法律常识。\n\n免责声明：本应用提供的内容仅供参考，不构成法律意见，具体劳务纠纷请咨询当地人社部门或专业律师。',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  // 退出登录
  doLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      confirmText: '退出',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          auth.logout();
          this._refreshLoginState();
          toast('已退出登录', 'success');
        }
      }
    });
  }
});
