const { apiRequest, toast } = require('../../utils/api');

Page({
  data: {
    text: '',
    textLength: 0,
    loading: false,
    result: null,
    savingRecord: false,
    canAnalyze: false
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

  // 加载示例合同
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
          toast('示例已加载', 'success');
        } else {
          toast('示例内容为空');
        }
      })
      .catch(err => {
        toast(err.message || '示例加载失败');
      });
  },

  // 开始检测
  startAnalyze() {
    if (!this.data.canAnalyze) {
      toast('请输入至少100个字符');
      return;
    }
    if (this.data.loading) return;
    this.setData({ loading: true, result: null });
    apiRequest('/contract/analyze', {
      method: 'POST',
      data: { text: this.data.text }
    })
      .then(result => {
        this.setData({ loading: false, result });
      })
      .catch(err => {
        this.setData({ loading: false });
        toast(err.message || '检测失败，请稍后重试');
      });
  },

  // 保存检测记录（后端 /contract/analyze 已自动保存记录，此处仅提示）
  saveRecord() {
    if (!this.data.result) {
      toast('请先完成检测');
      return;
    }
    toast('记录已保存', 'success');
  },

  // 重新检测
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
    wx.navigateTo({ url: '/pages/records/records?type=contract' });
  }
});
