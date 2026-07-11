const { apiRequest, toast } = require('../../utils/api');

const app = getApp();

Page({
  data: {
    text: '',
    textLength: 0,
    loading: false,
    analyzeStage: 0,
    analyzeProgress: 0,
    analyzeStageDesc: '整理条款和关键词',
    analyzeSteps: [
      { title: '读取合同文本', desc: '整理条款和关键词', active: true },
      { title: '识别需核对条款', desc: '检查试用期、扣款、违约金等内容', active: false },
      { title: '核对相关规则', desc: '匹配常见劳动规则信息', active: false },
      { title: '生成自查报告', desc: '整理需核对事项和提示', active: false }
    ],
    result: null,
    savingRecord: false,
    canAnalyze: false,
    // 字体缩放样式类
    fontScaleClass: ''
  },

  onLoad() {
    this._applyFontScale();
  },

  onShow() {
    // 从设置页返回时刷新字号偏好
    this._applyFontScale();
  },

  onUnload() {
    this._clearAnalyzeTimers();
  },

  // 应用字号缩放（中年劳动者字号偏大）
  _applyFontScale() {
    const scale = (app && app.globalData && app.globalData.fontScale) || 'medium';
    let cls = '';
    if (scale === 'large') cls = 'font-scale-large';
    else if (scale === 'extra-large') cls = 'font-scale-extra-large';
    if (this.data.fontScaleClass !== cls) {
      this.setData({ fontScaleClass: cls });
    }
  },

  // 文本输入
  onTextInput(e) {
    const text = e.detail.value;
    this.setData({
      text,
      textLength: text.length,
      canAnalyze: text.length >= 100
    });
  },

  // 粘贴合同文本
  pasteContract() {
    wx.getClipboardData({
      success: res => {
        if (res.data) {
          const text = res.data;
          this.setData({
            text,
            textLength: text.length,
            canAnalyze: text.length >= 100
          });
          toast('已粘贴', 'success');
        } else {
          toast('剪贴板为空');
        }
      },
      fail: () => {
        toast('读取剪贴板失败');
      }
    });
  },

  // 加载样例合同
  loadSample() {
    apiRequest('/config/contract_sample')
      .then(data => {
        // 兼容多种返回格式
        const text = (data && (data.text || data.content)) || (typeof data === 'string' ? data : '');
        if (text) {
          this.setData({
            text,
            textLength: text.length,
            canAnalyze: text.length >= 100
          });
          toast('样例已填入', 'success');
        } else {
          toast('样例内容为空');
        }
      })
      .catch(err => {
        toast(err.message || '样例加载失败');
      });
  },

  // 开始自查
  startAnalyze() {
    if (!this.data.canAnalyze) {
      toast('请输入至少100个字符');
      return;
    }
    if (this.data.loading) return;
    this._startAnalyzeProgress();
    apiRequest('/contract/analyze', {
      method: 'POST',
      data: { text: this.data.text }
    })
      .then(result => {
        this._finishAnalyzeProgress(result);
      })
      .catch(err => {
        this._clearAnalyzeTimers();
        this.setData({ loading: false, analyzeStage: 0, analyzeProgress: 0 });
        toast(err.message || '自查失败，请稍后重试');
      });
  },

  _startAnalyzeProgress() {
    this._clearAnalyzeTimers();
    this.setData({
      loading: true,
      result: null,
      analyzeStage: 0,
      analyzeProgress: 12,
      analyzeStageDesc: this.data.analyzeSteps[0].desc,
      analyzeSteps: this._buildAnalyzeSteps(0)
    });

    const stages = [
      { delay: 450, stage: 1, progress: 36 },
      { delay: 1100, stage: 2, progress: 68 },
      { delay: 1750, stage: 3, progress: 88 }
    ];

    this._analyzeTimers = stages.map(item => setTimeout(() => {
      if (!this.data.loading) return;
      this.setData({
        analyzeStage: item.stage,
        analyzeProgress: item.progress,
        analyzeStageDesc: this.data.analyzeSteps[item.stage].desc,
        analyzeSteps: this._buildAnalyzeSteps(item.stage)
      });
    }, item.delay));
  },

  _finishAnalyzeProgress(result) {
    this._clearAnalyzeTimers();
    this.setData({
      analyzeStage: 3,
      analyzeProgress: 100,
      analyzeStageDesc: this.data.analyzeSteps[3].desc,
      analyzeSteps: this._buildAnalyzeSteps(3)
    });
    this._analyzeTimers = [setTimeout(() => {
      this.setData({ loading: false, result }, () => {
        this._scrollToResult();
      });
    }, 380)];
  },

  _scrollToResult() {
    if (!wx.pageScrollTo) return;
    setTimeout(() => {
      wx.pageScrollTo({
        selector: '#contractResult',
        duration: 320,
        offsetTop: 16
      });
    }, 80);
  },

  _buildAnalyzeSteps(stage) {
    return (this.data.analyzeSteps || []).map((step, index) => ({
      title: step.title,
      desc: step.desc,
      active: index <= stage
    }));
  },

  _clearAnalyzeTimers() {
    if (!this._analyzeTimers) return;
    this._analyzeTimers.forEach(timer => clearTimeout(timer));
    this._analyzeTimers = null;
  },

  // 保存自查记录（后端 /contract/analyze 已自动保存记录，此处仅提示）
  saveRecord() {
    if (!this.data.result) {
      toast('请先完成自查');
      return;
    }
    toast('记录已保存', 'success');
  },

  copyCheckList() {
    const result = this.data.result;
    if (!result) {
      toast('请先完成自查');
      return;
    }

    const lines = [
      '合同条款自查核对清单',
      '共发现 ' + ((result.summary && result.summary.total) || 0) + ' 处待核对内容',
      ''
    ];

    const issues = Array.isArray(result.issues) ? result.issues : [];
    if (issues.length) {
      lines.push('需核对事项：');
      issues.slice(0, 8).forEach((item, index) => {
        lines.push((index + 1) + '. ' + (item.type || '条款') + '：' + (item.suggestion || '请结合合同原文核对'));
      });
      lines.push('');
    }

    const articles = Array.isArray(result.legalArticles) ? result.legalArticles : [];
    if (articles.length) {
      lines.push('相关规则来源：');
      articles.slice(0, 5).forEach((item, index) => {
        lines.push((index + 1) + '. ' + (item.title || item.source || '相关规则'));
        if (item.pkulawUrl) lines.push('原文链接：' + item.pkulawUrl);
      });
      lines.push('');
    }

    lines.push('材料提醒：请保存合同原件、工资记录、考勤记录和沟通记录。');
    lines.push('说明：本清单仅用于信息核对，不作为个案判断。');

    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => toast('核对清单已复制', 'success'),
      fail: () => toast('复制失败，请稍后重试')
    });
  },

  // 重新自查
  reset() {
    this.setData({
      text: '',
      textLength: 0,
      result: null,
      canAnalyze: false
    });
  },

  // 查看历史记录
  viewHistory() {
    if (!app.requireLogin('/pages/contract/contract')) return;
    wx.navigateTo({ url: '/pages/records/records?type=contract' });
  },

  copyLawLink(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) {
      toast('暂无原文链接');
      return;
    }
    wx.setClipboardData({
      data: url,
      success: () => toast('原文链接已复制', 'success'),
      fail: () => toast('复制失败，请稍后重试')
    });
  }
});
