// 首页：功能导航入口
const { toast } = require('../../utils/api');

const app = getApp();

Page({
  data: {
    // 字体缩放样式类
    fontScaleClass: '',
    // 功能卡片配置
    features: [
      {
        key: 'salary',
        title: '工资管理',
        subtitle: '记录与计算工资',
        icon: '💰',
        gradient: 'linear-gradient(135deg, #FF9800, #FF5722)',
        path: '/pages/salary/salary',
        isTab: true
      },
      {
        key: 'compensation',
        title: '补偿估算',
        subtitle: '经济补偿金计算',
        icon: '⚖️',
        gradient: 'linear-gradient(135deg, #2196F3, #3F51B5)',
        path: '/pages/compensation/compensation',
        isTab: false
      },
      {
        key: 'dispute',
        title: '争议解决',
        subtitle: '维权流程指引',
        icon: '🤝',
        gradient: 'linear-gradient(135deg, #4CAF50, #2E7D32)',
        path: '/pages/dispute/dispute',
        isTab: false
      },
      {
        key: 'contract',
        title: '合同体检',
        subtitle: '合同条款分析',
        icon: '📄',
        gradient: 'linear-gradient(135deg, #9C27B0, #6A1B9A)',
        path: '/pages/contract/contract',
        isTab: false
      }
    ]
  },

  onLoad() {
    this._applyFontScale();
  },

  onShow() {
    // 从其他页面返回时刷新字体缩放设置
    this._applyFontScale();
  },

  // 应用字体缩放
  _applyFontScale() {
    const scale = app.globalData.fontScale;
    let cls = '';
    if (scale === 'large') {
      cls = 'font-scale-large';
    } else if (scale === 'extra-large') {
      cls = 'font-scale-extra-large';
    }
    if (this.data.fontScaleClass !== cls) {
      this.setData({ fontScaleClass: cls });
    }
  },

  // 点击功能卡片
  onTapFeature(e) {
    const { path, tab } = e.currentTarget.dataset;
    if (!path) return;
    if (tab) {
      // tabBar 页面用 switchTab
      wx.switchTab({
        url: path,
        fail() {
          toast('页面跳转失败');
        }
      });
    } else {
      wx.navigateTo({
        url: path,
        fail() {
          toast('页面暂未开放');
        }
      });
    }
  }
});
