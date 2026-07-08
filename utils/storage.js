/**
 * Local storage helper with key isolation by user.
 */

const KEY_PREFIX = 'yunke_';

function _key(key) {
  return KEY_PREFIX + key;
}

function get(key, defaultValue) {
  try {
    const value = wx.getStorageSync(_key(key));
    return value === '' || value === undefined ? defaultValue : value;
  } catch (e) {
    return defaultValue;
  }
}

function set(key, value) {
  try {
    wx.setStorageSync(_key(key), value);
  } catch (e) {}
}

function remove(key) {
  try {
    wx.removeStorageSync(_key(key));
  } catch (e) {}
}

function clearAll() {
  try {
    const info = wx.getStorageInfoSync();
    info.keys.forEach(k => {
      if (k.indexOf(KEY_PREFIX) === 0) {
        wx.removeStorageSync(k);
      }
    });
  } catch (e) {}
}

module.exports = { get, set, remove, clearAll, KEY_PREFIX };
