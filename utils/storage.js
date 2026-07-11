/**
 * Local storage helper with key isolation by user.
 */

const KEY_PREFIX = 'yunke_';

// Auth-related keys stored WITHOUT the yunke_ prefix for historical reasons.
// These must be cleared explicitly by clearAll() so logout-on-clear works.
const AUTH_KEYS = ['worker_law_user'];

// Legacy user-preference keys stored WITHOUT the yunke_ prefix.
// Listed here so clearAll() can wipe them alongside the yunke_* namespace.
const LEGACY_KEYS = [
  'hourly_rate',
  'night_rate',
  'font_scale',
  'default_shift',
  'notify_enabled',
  'notify_time'
];

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
    // Auth keys have no prefix; remove them explicitly so the user is logged out.
    AUTH_KEYS.forEach(k => {
      try { wx.removeStorageSync(k); } catch (e) {}
    });
    // Legacy no-prefix preference keys: also wipe so "clear data" really clears everything.
    LEGACY_KEYS.forEach(k => {
      try { wx.removeStorageSync(k); } catch (e) {}
    });
  } catch (e) {}
}

module.exports = { get, set, remove, clearAll, KEY_PREFIX, AUTH_KEYS, LEGACY_KEYS };
