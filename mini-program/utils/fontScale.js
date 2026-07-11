function normalizeFontScale(scale) {
  if (scale === 'small') return 'small';
  if (scale === 'large' || scale === 'extra-large') return 'large';
  return 'medium';
}

function getFontScaleClass(scale) {
  const normalized = normalizeFontScale(scale);
  if (normalized === 'small') return 'font-scale-small';
  if (normalized === 'large') return 'font-scale-large';
  return '';
}

function getCurrentFontScale(app) {
  const globalScale = app && app.globalData && app.globalData.fontScale;
  if (globalScale) return normalizeFontScale(globalScale);
  try {
    return normalizeFontScale(wx.getStorageSync('yunke_font_scale') || wx.getStorageSync('font_scale'));
  } catch (e) {
    return 'medium';
  }
}

function applyPageFontScale(page, app) {
  if (!page || !page.setData) return;
  const cls = getFontScaleClass(getCurrentFontScale(app));
  if (!page.data || page.data.fontScaleClass !== cls) {
    page.setData({ fontScaleClass: cls });
  }
}

module.exports = {
  normalizeFontScale,
  getFontScaleClass,
  getCurrentFontScale,
  applyPageFontScale
};
