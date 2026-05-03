/**
 * 核心工具.js - 销售客户管理系统 v4.0.0
 * 职责：数据存储（Firebase云同步+localStorage本地备份）、工具函数、全局状态、初始化
 * 云同步方式：Firebase REST API（不加载 SDK，绕过国内网络限制）
 */
// 版本标记：20260503-1730（修复：添加强制同步按钮、清空云端数据功能）
console.log('[核心工具.js] 已加载，版本: 202605040110');

// ==================== 全局数据存储层（统一存储，兼容云端同步）====================
window.DB = {
  _inited: false,
  // 初始化 APP.db（从 localStorage 迁移数据）
  _init() {
    if (this._inited) return;
    this._inited = true;
    if (!window.APP) window.APP = {};
    if (window.APP.db) return; // 已初始化
    
    window.APP.db = {
      customers: [],
      sw_orders: [],
      hw_orders: [],
      products: [],
      keycodes: [],
      brands: [],
      sw_tpl: { content: '', tips: '' },
      hw_tpl: { content: '', tips: '' },
      settings: {},
      custom_fields: [],
      _syncing: false
    };
    // 迁移旧数据
    const oldKeys = ['customers', 'sw_orders', 'hw_orders', 'products', 'keycodes', 'brands', 'sw_tpl', 'hw_tpl', 'settings', 'custom_fields'];
    oldKeys.forEach(function(key) {
      try {
        const v = localStorage.getItem('crm_' + key);
        if (v !== null) {
          window.APP.db[key] = JSON.parse(v);
          console.log('[DB] 迁移数据: ' + key + ' (' + (Array.isArray(window.APP.db[key]) ? window.APP.db[key].length : 'object') + ' 条)');
        }
      } catch(e) {}
    });
  },
  get(key, def) {
    this._init();
    if (def === undefined) def = [];
    return window.APP.db && window.APP.db[key] !== undefined ? window.APP.db[key] : def;
  },
  set(key, val) {
    this._init();
    try {
      window.APP.db[key] = val;
      localStorage.setItem('crm_' + key, JSON.stringify(val));
      // 触发云端同步
      if (window.saveDB) window.saveDB();
    } catch (e) { console.error('[DB] 存储失败:', e); }
  }
};

// ==================== Firebase 云端同步（SSE实时 + REST轮询降级）====================
window.APP_FIREBASE_CONFIG = null;
window.APP_FIREBASE_INITIALIZED = false;
window.APP_CLOUD_POLLING_TIMER = null;
window.APP_CLOUD_SSE_SOURCE = null;     // EventSource 实例
window.APP_CLOUD_LAST_SAVE_TIME = 0;  // 上次自己保存的时间戳，避免重复拉取自己刚写入的数据

// 获取 Firebase REST URL
function getCloudUrl(path) {
  const config = (window.APP.db && window.APP.db.settings && window.APP.db.settings.firebaseConfig) || window.APP_FIREBASE_CONFIG;
  if (!config || !config.databaseURL) return null;
  const base = config.databaseURL.replace(/\/+$/, '');
  const p = (path || 'sales_crm_db').replace(/^\//, '');
  return base + '/' + p + '.json';
}

// 获取带 auth 参数的 SSE URL
function getSSEUrl() {
  const url = getCloudUrl('sales_crm_db');
  if (!url) return null;
  const config = (window.APP.db && window.APP.db.settings && window.APP.db.settings.firebaseConfig) || window.APP_FIREBASE_CONFIG;
  const apiKey = config && config.apiKey ? config.apiKey : '';
  return url + '?auth=' + apiKey + '&print=sse';
}

// 初始化云同步（REST API 方式，无需加载 SDK）
function initFirebase() {
  const config = (window.APP.db && window.APP.db.settings && window.APP.db.settings.firebaseConfig) || window.APP_FIREBASE_CONFIG;
  if (!config || !config.databaseURL) return false;
  window.APP_FIREBASE_CONFIG = config;
  window.APP_FIREBASE_INITIALIZED = true;
  // Firebase 配置完成（databaseURL:', config.databaseURL + ')');
  return true;
}

// 确保db结构完整（防止云端数据缺少某些字段导致undefined）
function normalizeDB(db) {
  db = db || {};
  db.customers = Array.isArray(db.customers) ? db.customers : [];
  db.orders = Array.isArray(db.orders) ? db.orders : [];
  db.products = Array.isArray(db.products) ? db.products : [];
  db.cards = Array.isArray(db.cards) ? db.cards : [];
  db.keys = Array.isArray(db.keys) ? db.keys : [];
  db.settings = db.settings || {};
  // 保护 orderManagement.orders
  db.orderManagement = db.orderManagement || {};
  db.orderManagement.orders = Array.isArray(db.orderManagement.orders) ? db.orderManagement.orders : [];
  return db;
}

// fetch 超时包装（国内网络超时设为20秒）
function fetchWithTimeout(url, options, timeoutMs) {
  timeoutMs = timeoutMs || 20000;
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
  ]);
}

// 从云端加载数据（REST API GET）
async function loadFromCloud(throwOnError) {
  const url = getCloudUrl('sales_crm_db');
  if (!url) {
    if (throwOnError) throw new Error('databaseURL 为空，请检查配置');
    return null;
  }
  try {
    const resp = await fetchWithTimeout(url, { method: 'GET' }, 20000);
    if (!resp.ok) {
      let detail = '';
      try { detail = await resp.text(); } catch(e2) {}
      const msg = 'HTTP ' + resp.status + (detail ? '：' + detail.substring(0, 100) : '');
      if (throwOnError) throw new Error(msg);
      return null;
    }
    const text = await resp.text();
    if (!text || text === 'null' || text.trim() === '') return null;
    return JSON.parse(text);
  } catch (e) {
    if (throwOnError) throw e;
    // loadFromCloud 失败:', e.message);
    return null;
  }
}

// 保存到云端（REST API PUT）
async function saveToCloud(data) {
  const url = getCloudUrl('sales_crm_db');
  if (!url) { console.error('[Cloud] saveToCloud: URL 为空'); return false; }
  try {
    window.APP_CLOUD_LAST_SAVE_TIME = Date.now();
    const resp = await fetchWithTimeout(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }, 20000);
    if (resp.ok) {  return true; }
    console.error('[Cloud] ❌ 写入失败:', resp.status);
    return false;
  } catch (e) {
    console.error('[Cloud] ❌ 写入失败:', e.message);
    return false;
  }
}

// 应用云端数据（合并策略：以云端为准，但保留本地未同步的新数据）
function applyCloudData(cloudData) {
  if (!cloudData) return;
  const local = window.APP.db;
  if (!local) return;

  // 简单策略：云端数据直接覆盖（云端是最新权威来源）
  // 记录当前页面，刷新后恢复
  const currentPage = window.APP.currentPage;
  window.APP.db = normalizeDB(cloudData);
  saveDB_localOnly();

  // 重新渲染当前页面
  if (currentPage && typeof navigateTo === 'function') {
    navigateTo(currentPage);
  } else if (typeof renderDashboard === 'function') {
    renderDashboard();
  }
  // 已应用云端数据');
}

// ==================== 实时云同步（Firebase Realtime Database 轮询）====================
// Firebase Realtime Database REST API 不支持 SSE，改为每 5 秒轮询检测变化
function startCloudPolling() {
  if (window.APP_CLOUD_POLLING_TIMER) return;
  // 云同步轮询已启动（每5秒）');

  // 首次延迟 3 秒后立即同步一次（页面加载完立即拉取）
  setTimeout(function() { pollCloudOnce(); }, 3000);

  window.APP_CLOUD_POLLING_TIMER = setInterval(pollCloudOnce, 5000);
}

async function pollCloudOnce() {
  if (!window.APP_FIREBASE_INITIALIZED || !window.APP.db) return;
  // 自己刚保存的，跳过（避免回读自己刚写入的数据）
  if (Date.now() - window.APP_CLOUD_LAST_SAVE_TIME < 3000) return;
  try {
    const cloudData = await loadFromCloud();
    if (!cloudData) return;
    // 用 JSON.stringify 对比（属性顺序一致时有效）
    const localStr = JSON.stringify(window.APP.db);
    const cloudStr = JSON.stringify(cloudData);
    if (localStr !== cloudStr) {
      // 检测到云端数据变化，正在同步...');
      applyCloudData(cloudData);
      showToast('📱 云端数据已同步', 'info', 2000);
    }
  } catch(e) {
    // 静默失败，不打断用户
  }
}

function stopCloudPolling() {
  if (window.APP_CLOUD_POLLING_TIMER) {
    clearInterval(window.APP_CLOUD_POLLING_TIMER);
    window.APP_CLOUD_POLLING_TIMER = null;
  }
  if (window.APP_CLOUD_SSE_SOURCE) {
    window.APP_CLOUD_SSE_SOURCE.close();
    window.APP_CLOUD_SSE_SOURCE = null;
  }
}

// 手动同步按钮：从云端拉取最新数据并应用（用户主动触发）
window._syncInProgress = false;
async function syncNow() {
  const icon = document.getElementById('sync-icon');
  const sidebarIcon = document.getElementById('sidebar-sync-icon');
  const sidebarText = document.getElementById('sidebar-sync-text');
  
  // 防止重复点击
  if (window._syncInProgress) {
    showToast('同步进行中，请稍候...', 'warning');
    return;
  }
  window._syncInProgress = true;
  
  try {
    // 显示加载状态（旋转动画）
    if (icon) icon.style.animation = 'spin 0.8s linear infinite';
    if (sidebarIcon) sidebarIcon.style.animation = 'spin 0.8s linear infinite';
    if (sidebarText) sidebarText.textContent = '同步中...';
    
    // 检查 Firebase 是否初始化
    if (!window.APP_FIREBASE_INITIALIZED) {
      // 尝试从 settings 中获取配置并初始化
      const s = window.APP.db && window.APP.db.settings;
      if (s && s.firebaseConfig && s.firebaseConfig.apiKey) {
        window.APP_FIREBASE_CONFIG = s.firebaseConfig;
        initFirebase();
      }
    }
    
    if (!window.APP_FIREBASE_INITIALIZED) {
      showToast('⚠️ 请先在系统设置中配置并启用云端同步', 'warning', 3000);
      return;
    }
    
    console.log('[Sync] 开始同步...');
    const cloudData = await loadFromCloud();
    
    if (cloudData) {
      // 云端有数据：用云端数据覆盖本地
      const oldCount = (window.APP.db && window.APP.db.customers) ? window.APP.db.customers.length : 0;
      const newCount = cloudData.customers ? cloudData.customers.length : 0;
      
      window.APP.db = normalizeDB(cloudData);
      saveDB_localOnly();
      
      // 重新渲染当前页面
      const currentPage = window.APP.currentPage || 'dashboard';
      const renderMap = {
        dashboard: typeof renderDashboard === 'function' ? renderDashboard : null,
        customers: typeof renderCustomers === 'function' ? renderCustomers : null,
        orders: typeof renderOrders === 'function' ? renderOrders : null,
        cards: typeof renderCards === 'function' ? renderCards : null,
        products: typeof renderProducts === 'function' ? renderProducts : null,
        stats: typeof renderStats === 'function' ? renderStats : null,
        settings: typeof renderSettings === 'function' ? renderSettings : null,
      };
      if (renderMap[currentPage]) renderMap[currentPage]();
      
      showToast('✅ 同步成功！已从云端拉取 ' + newCount + ' 条客户数据', 'success', 3000);
      console.log('[Sync] 同步成功：本地 ' + oldCount + ' 条 → 云端 ' + newCount + ' 条');
    } else {
      // 云端无数据：把本地数据推送到云端
      const ok = await saveToCloud(window.APP.db);
      if (ok) {
        showToast('✅ 本地数据已推送至云端', 'success', 3000);
        console.log('[Sync] 本地数据已推送到云端');
      } else {
        showToast('⚠️ 云端推送失败，请检查网络', 'warning', 3000);
      }
    }
  } catch (e) {
    console.error('[Sync] 同步失败：', e);
    showToast('❌ 同步失败：' + e.message, 'error', 4000);
  } finally {
    // 恢复按钮状态
    window._syncInProgress = false;
    if (icon) icon.style.animation = '';
    if (sidebarIcon) sidebarIcon.style.animation = '';
    if (sidebarText) sidebarText.textContent = '同步数据';
  }
}

// 推送本地数据到云端（不清除本地）
async function pushLocalToCloud() {
  if (!window.APP_FIREBASE_INITIALIZED) {
    const s = window.APP.db && window.APP.db.settings;
    if (s && s.firebaseConfig && s.firebaseConfig.apiKey) {
      window.APP_FIREBASE_CONFIG = s.firebaseConfig;
      initFirebase();
    }
  }
  if (!window.APP_FIREBASE_INITIALIZED) {
    showToast('⚠️ 云同步未启用', 'warning');
    return false;
  }
  return await saveToCloud(window.APP.db);
}

// 清空云端数据（危险操作）
async function clearCloudData() {
  if (!confirm('确定要清空所有云端数据吗？此操作不可恢复！')) return;
  if (!confirm('再次确认：清空后云端所有客户、订单、卡密数据将被删除！')) return;
  
  const url = getCloudUrl('sales_crm_db');
  if (!url) {
    showToast('❌ 云端URL无效', 'error');
    return;
  }
  try {
    // 使用DELETE方法清空数据
    const resp = await fetchWithTimeout(url, { method: 'DELETE' }, 20000);
    if (resp.ok || resp.status === 200) {
      showToast('✅ 云端数据已清空', 'success', 3000);
      // 云端数据已清空');
    } else {
      showToast('⚠️ 清空失败：' + resp.status, 'error');
    }
  } catch (e) {
    showToast('❌ 清空失败：' + e.message, 'error');
  }
}

// 启动云端轮询监听（每 5 秒检测一次变化，替代 Firebase SDK 的 on()）
function startCloudPolling() {
  if (window.APP_CLOUD_POLLING_TIMER) return; // 防止重复启动
  window.APP_CLOUD_POLLING_TIMER = setInterval(async function() {
    if (!window.APP_FIREBASE_INITIALIZED) return;
    const url = getCloudUrl('sales_crm_db');
    if (!url) return;
    try {
      const resp = await fetchWithTimeout(url, { method: 'GET' }, 20000);
      if (!resp.ok) return;
      const text = await resp.text();
      if (!text || text === 'null' || text.trim() === '') return;
      const cloudData = JSON.parse(text);
      const cloudHash = JSON.stringify(cloudData);
      // 如果云端数据有变化（不是自己刚写入的），合并并更新本地
      if (cloudHash !== window.APP_CLOUD_LAST_HASH && window.APP_CLOUD_LAST_HASH !== null) {
        // 检测到其他设备数据变化，正在同步...');
        const local = loadDB_localOnly();
        const merged = mergeData(local, cloudData);
        window.APP.db = normalizeDB(merged);
        saveDB_localOnly();
        window.APP_CLOUD_LAST_HASH = cloudHash;
        if (window.APP.currentPage) navigateTo(window.APP.currentPage);
        showToast('数据已从其他设备同步', 'info');
      }
      window.APP_CLOUD_LAST_HASH = cloudHash;
    } catch (e) { /* 静默失败，不影响用户 */ }
  }, 5000); // 每 5 秒检查一次
  // 轮询监听已启动（每 5 秒）');
}

// 停止轮询
function stopCloudPolling() {
  if (window.APP_CLOUD_POLLING_TIMER) {
    clearInterval(window.APP_CLOUD_POLLING_TIMER);
    window.APP_CLOUD_POLLING_TIMER = null;
    // 轮询已停止');
  }
}

// 启动云端监听（轮询 + 页面可见立即同步）
function listenCloudChanges(callback) {
  if (!window.APP_FIREBASE_INITIALIZED) return;

  // 启动 5 秒轮询
  startCloudPolling();

  // 页面从后台恢复时立即同步一次
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden && window.APP_FIREBASE_INITIALIZED) {
      // 页面恢复可见，立即检查云端数据');
      pollCloudOnce();
    }
  });

  if (typeof callback === 'function') callback();
}

// 合并本地和云端数据（云端优先，时间戳较新的优先）
function mergeData(local, cloud) {
  if (!cloud) return local;
  if (!local) return cloud;
  const result = JSON.parse(JSON.stringify(cloud));
  // 对每个数组，取并集，相同ID保留时间戳较新的版本
  ['customers', 'orders', 'products', 'cards', 'cardRecords'].forEach(key => {
    if (!Array.isArray(result[key])) result[key] = [];
    if (!Array.isArray(local[key])) local[key] = [];
    const map = {};
    [...(result[key] || []), ...(local[key] || [])].forEach(item => {
      if (!item || !item.id) return;
      if (!map[item.id] || (item.updatedAt && map[item.id].updatedAt && item.updatedAt > map[item.id].updatedAt)) {
        map[item.id] = item;
      }
    });
    result[key] = Object.values(map);
  });
  // settings 以云端为准
  if (local.settings) {
    result.settings = { ...local.settings, ...cloud.settings };
  }
  return result;
}

// ==================== 全局状态 ====================
window.APP = {
  currentPage: 'dashboard',
  db: null,
  settings: {}
};

// ==================== 数据存储KEY ====================
const DB_KEY = '销售管理数据库';

// ==================== 数据结构初始化 ====================
function getEmptyDB() {
  return {
    customers: [],
    orders: [],
    products: [],
    cards: [],
    cardRecords: [],
    settings: {
      siteName: '销售客户管理系统',
      siteLogo: '',
      theme: 'dark',      // 'dark' | 'light' | 'system'
      expressCustomer: '',
      expressKey: '',
      softwareCopyTemplate: '产品：{产品名称}，订单号：{订单号}，卡密：{卡密}，有效期：{有效期}，购买日期：{购买日期}，金额：¥{金额}，数量：{数量}\n温馨提示：请妥善保存好卡密，仅供学习使用，禁止违法用途，如因个人原因责任需自行承担责任，感谢您的购买，欢迎推荐，推荐享受推荐好礼，赠送时长等。',
      hardwareCopyTemplate: '产品：{产品名称}，金额：¥{金额}，数量：{数量}，订单号：{订单号}，快递：{快递公司}，物流单号：{物流单号}\n温馨提示：请妥善保存，仅供学习使用，禁止违法用途，如因个人原因责任需自行承担责任，感谢您的购买，欢迎推荐，推荐享受增加延长多种保障优惠，享受佣金等奖励。',
      customerSources: ['微信群', '朋友推荐', '网络广告', '老客户介绍', '其他'],
      firebaseConfig: {
        apiKey: "AIzaSyAi3pnZg6CvovvnKRDAav3KPmBY_1i0s_M",
        authDomain: "gorun-687e6.firebaseapp.com",
        databaseURL: "https://gorun-687e6-default-rtdb.firebaseio.com",
        projectId: "gorun-687e6",
        storageBucket: "gorun-687e6.firebasestorage.app",
        messagingSenderId: "554341650997",
        appId: "1:554341650997:web:c548a01d191547416a977c"
      }
    },
    productDisplayData: {},
    version: '4.0.0'
  };
}

// ==================== 预设商品 ====================
// 产品名称保持简洁，描述信息放在"备注"字段（订单管理中可查看）
// 用户可自行在商品管理中增删改，此处仅作初始示例
const DEFAULT_PRODUCTS = [
  { name: '路通月卡', type: 'software', price: 80, cost: 7, note: '打卡使用，安卓系统，一机一码' },
  { name: '路通半年卡', type: 'software', price: 150, cost: 38, note: '打卡使用，安卓系统，一机一码' },
  { name: '路通年卡', type: 'software', price: 268, cost: 89, note: '打卡使用，安卓系统，一机一码' },
  { name: '蓝牙打卡器', type: 'hardware', price: 288, cost: 100, note: '连接考勤机蓝牙打卡，顺丰包邮' },
  { name: 'iPhone15以上C口定位器', type: 'hardware', price: 288, cost: 110, note: '全局修改定位，不绑定手机，永久使用，顺丰包邮' },
  { name: 'iPhone14以下L口定位器', type: 'hardware', price: 288, cost: 150, note: '全局修改定位，不绑定手机，永久使用，顺丰包邮' },
  { name: 'iPhone全系列CL双口定位器', type: 'hardware', price: 388, cost: 200, note: '全局修改定位，不绑定手机，永久使用，顺丰包邮' }
];

// ==================== 本地数据读写（不触发云同步）====================
function loadDB_localOnly() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return normalizeDB(data);
    }
  } catch (e) {
    console.error('本地数据加载失败', e);
  }
  return null;
}

function saveDB_localOnly() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(window.APP.db));
  } catch (e) {
    console.error('本地数据保存失败', e);
    showToast('本地数据保存失败，存储空间可能不足', 'error');
  }
}

// ==================== 统一加载（云端优先，云端无则本地，本地无则初始化）====================
async function loadDB() {
  const cloudData = await loadFromCloud();
  if (cloudData) {
    window.APP.db = normalizeDB(cloudData);
    saveDB_localOnly(); // 同步到本地备份
    return;
  }
  const localData = loadDB_localOnly();
  if (localData) {
    window.APP.db = normalizeDB(localData);
  } else {
    window.APP.db = getEmptyDB();
    initDefaultData();
  }
}

// ==================== 统一保存（本地+云端双写）====================
let _cloudSyncTimer = null;
function saveDB() {
  saveDB_localOnly();
  // 防抖：延迟500ms合并写入云端，避免频繁写入
  if (_cloudSyncTimer) clearTimeout(_cloudSyncTimer);
  _cloudSyncTimer = setTimeout(async () => {
    const ok = await saveToCloud(window.APP.db);
    if (ok === false) {
      // 云端同步失败，数据已保存在本设备');
    }
  }, 500);
}




function initDefaultData() {
  const db = window.APP.db;
  DEFAULT_PRODUCTS.forEach(p => {
    db.products.push({
      id: genId(),
      name: p.name,
      type: p.type,
      price: p.price,
      cost: p.cost,
      createdAt: Date.now()
    });
  });
  saveDB();
}

// ==================== ID生成 ====================
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

// ==================== 订单号生成（调整7：软件RJ-，硬件YJ-）====================
function genOrderNo(type) {
  const db = window.APP.db;
  const prefix = type === 'software' ? 'RJ' : 'YJ';
  const today = formatDate(new Date(), 'YYYYMMDD');
  const existingToday = db.orders.filter(o => {
    const parts = o.orderNo ? o.orderNo.split('-') : [];
    const orderDate = parts[1] || '';
    return o.type === type && orderDate === today;
  });
  const seq = String(existingToday.length + 1).padStart(4, '0');
  return `${prefix}-${today}-${seq}`;
}

// ==================== 日期工具 ====================
function formatDate(date, fmt = 'YYYY-MM-DD') {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return fmt
    .replace('YYYY', y)
    .replace('MM', m)
    .replace('DD', day)
    .replace('HH', h)
    .replace('mm', min)
    .replace('ss', sec);
}

function formatDatetime(ts) {
  if (!ts) return '';
  return formatDate(new Date(ts), 'YYYY-MM-DD HH:mm');
}

function todayStr() {
  return formatDate(new Date(), 'YYYY-MM-DD');
}

function calcExpireDate(startDate, category) {
  if (!startDate) return '';
  const d = new Date(startDate);
  if (isNaN(d.getTime())) return '';
  switch (category) {
    case 'temp': d.setDate(d.getDate() + 1); break;
    case 'monthly': d.setDate(d.getDate() + 30); break;
    case 'quarterly': d.setDate(d.getDate() + 90); break;
    case 'halfyear': d.setDate(d.getDate() + 180); break;
    case 'yearly': d.setDate(d.getDate() + 365); break;
    case 'permanent': d.setFullYear(d.getFullYear() + 10); break;
    default: return '';
  }
  return formatDate(d, 'YYYY-MM-DD');
}

// 获取完整时间字符串（年月日时分秒）
function getFullDatetime() {
  return formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss');
}

function calcRemainingDays(expireDate) {
  if (!expireDate) return null;
  const exp = new Date(expireDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp - now) / 86400000);
}

// 格式化卡密剩余时间为可读文本（调整9补充）
function formatRemainingTime(expireDate) {
  if (!expireDate) return '';
  const days = calcRemainingDays(expireDate);
  if (days === null) return '';
  if (days < 0) return `<span style="color:#ef4444;font-size:11px">已过期${Math.abs(days)}天</span>`;
  if (days === 0) return `<span style="color:#f59e0b;font-size:11px">今日到期</span>`;
  if (days <= 7) return `<span style="color:#f59e0b;font-size:11px">剩余${days}天</span>`;
  if (days <= 30) return `<span style="color:#7dd3fc;font-size:11px">剩余${days}天</span>`;
  return `<span style="color:#10b981;font-size:11px">剩余${days}天</span>`;
}

function getCardCategoryLabel(cat) {
  const map = {
    temp: '临时卡', monthly: '月卡', quarterly: '季卡',
    halfyear: '半年卡', yearly: '年卡', permanent: '永久卡'
  };
  return map[cat] || cat || '';
}

// ==================== iPhone插口自动识别 ====================
function detectIphonePort(model) {
  if (!model) return '';
  const match = model.match(/(\d+)/);
  if (!match) return '';
  const gen = parseInt(match[1]);
  if (gen >= 15) return 'C';
  if (gen >= 7) return 'L';
  return '';
}

// ==================== 手机品牌列表 ====================
const PHONE_BRANDS = [
  '苹果(Apple)', '华为(Huawei)', '小米(Xiaomi)', '三星(Samsung)',
  'OPPO', 'vivo', '荣耀(Honor)', '一加(OnePlus)', '魅族(Meizu)',
  '红米(Redmi)', 'iQOO', '联想(Lenovo)', '其他'
];

// ==================== 快递公司列表 ====================
const EXPRESS_COMPANIES = [
  '顺丰速运', '圆通速递', '中通快递', '韵达快递', '申通快递',
  '百世快递', '极兔速运', '邮政EMS', '京东物流', '德邦快递'
];

// ==================== Toast通知 ====================
function showToast(msg, type = 'success', duration = 2500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  toast.style.cssText = `
    background:${colors[type] || colors.info};color:#fff;padding:10px 18px;
    border-radius:8px;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);
    display:flex;align-items:center;gap:8px;min-width:200px;max-width:350px;
    animation:slideInRight 0.3s ease;
  `;
  toast.innerHTML = `<span style="font-weight:bold">${icons[type]}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ==================== 弹窗工具 ====================
function showModal(title, content, footer = '', size = 'md') {
  closeModal();
  const sizeMap = { sm: '400px', md: '600px', lg: '800px', xl: '1000px' };
  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);background:rgba(0,0,0,0.65);';
  overlay.innerHTML = `
    <div id="modal-box" class="modal-box" style="border-radius:12px;width:${sizeMap[size]||'600px'};max-width:95vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5);background:var(--bg-card,#1e2235);border:1px solid var(--border,#2d3555);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border,#2d3555);">
        <h3 style="color:var(--text-primary,#e2e8f0);font-size:16px;font-weight:600;margin:0;">${title}</h3>
        <button onclick="closeModal()" style="background:none;border:none;color:var(--text-secondary,#94a3b8);font-size:20px;cursor:pointer;line-height:1;padding:0 4px;">&times;</button>
      </div>
      <div id="modal-body" style="padding:20px;overflow-y:auto;flex:1;">${content}</div>
      ${footer ? `<div style="padding:16px 20px;border-top:1px solid var(--border,#2d3555);display:flex;justify-content:flex-end;gap:10px;">${footer}</div>` : ''}
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}

function closeModal() {
  const el = document.getElementById('modal-overlay');
  if (el) el.remove();
}

// ==================== 确认弹窗（v20260502 使用原生 confirm 临时方案）====================
function confirmDialog(msg, onConfirm, title) {
  // 临时方案：使用原生 confirm，彻底绕过 DOM 弹窗点击无响应问题
  // 待原生 confirm 验证 callback 能正常执行后，再恢复自定义弹窗
  var plain = msg.replace(/<[^>]+>/g, ''); // 去掉 HTML 标签
  if (window.confirm(plain + '\n\n点击「确定」继续执行，点击「取消」中止。')) {
    try {
      if (typeof onConfirm === 'function') onConfirm();
    } catch(e) {
      console.error('[confirmDialog] 回调执行出错:', e);
      showToast('操作执行出错：' + e.message, 'error');
    }
  }
}

// ==================== 复制到剪贴板 ====================
async function copyToClipboard(text, msg = '已复制到剪贴板') {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    showToast(msg, 'success');
  } catch (e) {
    showToast('复制失败，请手动复制', 'error');
  }
}

// ==================== 模板渲染 ====================
function renderTemplate(template, vars) {
  let result = template;
  Object.entries(vars).forEach(([k, v]) => {
    result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), v || '');
  });
  return result;
}

// ==================== 金额格式化 ====================
function formatMoney(num) {
  if (num === null || num === undefined || isNaN(num)) return '0.00';
  return Number(num).toFixed(2);
}

// ==================== 搜索过滤工具 ====================
function filterList(list, keyword, fields) {
  if (!keyword) return list;
  const kw = keyword.toLowerCase();
  return list.filter(item =>
    fields.some(f => String(item[f] || '').toLowerCase().includes(kw))
  );
}

// ==================== 分页工具 ====================
function paginate(list, page, pageSize = 15) {
  const total = list.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const items = list.slice(start, start + pageSize);
  return { items, total, totalPages, page, pageSize };
}

function renderPager(containerId, pager, onPage) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (pager.totalPages <= 1) { el.innerHTML = ''; return; }
  // 将回调存入全局注册表，避免 onclick 中函数丢失
  const cbName = '_pagerCb_' + Math.random().toString(36).substr(2, 6);
  window[cbName] = onPage;
  let html = `<div class="pager">`;
  html += `<button ${pager.page <= 1 ? 'disabled' : ''} onclick="window.${cbName}(${pager.page - 1})">上一页</button>`;
  for (let i = 1; i <= pager.totalPages; i++) {
    if (i === 1 || i === pager.totalPages || Math.abs(i - pager.page) <= 2) {
      html += `<button class="${i === pager.page ? 'active' : ''}" onclick="window.${cbName}(${i})">${i}</button>`;
    } else if (Math.abs(i - pager.page) === 3) {
      html += `<span>...</span>`;
    }
  }
  html += `<button ${pager.page >= pager.totalPages ? 'disabled' : ''} onclick="window.${cbName}(${pager.page + 1})">下一页</button>`;
  html += `<span class="pager-info">共${pager.total}条 / ${pager.totalPages}页</span>`;
  html += `</div>`;
  el.innerHTML = html;
}

// ==================== 切换页面 ====================
function navigateTo(page) {
  window.APP.currentPage = page;
  // 更新侧边栏高亮
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  // 切换内容区
  document.querySelectorAll('.page-section').forEach(el => {
    el.style.display = el.id === `page-${page}` ? 'block' : 'none';
  });
  // 触发对应模块渲染
  const renderMap = {
    dashboard: typeof renderDashboard === 'function' ? renderDashboard : null,
    customers: typeof renderCustomers === 'function' ? renderCustomers : null,
    orders: typeof renderOrders === 'function' ? renderOrders : null,
    cards: typeof renderCards === 'function' ? renderCards : null,
    products: typeof renderProducts === 'function' ? renderProducts : null,
    stats: typeof renderStats === 'function' ? renderStats : null,
    settings: typeof renderSettings === 'function' ? renderSettings : null
  };
  const fn = renderMap[page];
  const el = document.getElementById('page-' + page);
  if (!fn) {
    console.error('[navigateTo] ' + page + ' 的渲染函数未定义（JS文件可能加载失败）');
    if (el) {
      el.innerHTML = '<div style="padding:40px;color:#ef4444;">⚠️ ' + page + ' 页面加载失败：渲染函数未定义<br><small style="color:#94a3b8">可能原因：JS文件语法错误，请按F12控制台查看报错</small></div>';
    }
    return;
  }
  try {
    fn();
  } catch(e) {
    console.error('[navigateTo] ' + page + ' 渲染失败：', e);
    if (el) {
      el.innerHTML = '<div style="padding:40px;color:#ef4444;">⚠️ ' + page + ' 页面渲染失败：' + e.message + '<br><small style="color:#94a3b8">请按F12打开控制台查看详细错误</small></div>';
    }
  }
}

// ==================== 初始化入口（优化：本地数据优先显示，云端后台同步）====================
async function initApp() {
  var loadingEl = document.getElementById('app-loading');

  // 安全网：10秒后强制隐藏 loading 屏，防止任何情况下卡死
  var safetyTimer = setTimeout(function() {
    var el = document.getElementById('app-loading');
    if (el) { el.style.display = 'none'; console.warn('[initApp] 安全网触发：强制隐藏 loading 屏'); }
  }, 10000);

  try {
    // 第一步：立即加载本地数据并渲染（不等待云端，秒开）
    var localData = loadDB_localOnly();
    if (localData) {
      window.APP.db = normalizeDB(localData);
    } else {
      window.APP.db = getEmptyDB();
      initDefaultData();
    }

    // 立即应用设置并渲染工作台
    var s = window.APP.db.settings;
    if (s.siteName) {
      document.title = s.siteName;
      var titleEl = document.getElementById('site-title');
      if (titleEl) titleEl.textContent = s.siteName;
    }
    if (s.siteLogo) {
      var logoEl = document.getElementById('site-logo');
      if (logoEl) { logoEl.src = s.siteLogo; logoEl.style.display = 'block'; }
    }
    applyTheme();

    // 直接渲染工作台内容
    window.APP.currentPage = 'dashboard';
    var dashboardEl = document.getElementById('page-dashboard');
    if (dashboardEl) dashboardEl.style.display = 'block';

    // 安全调用 renderDashboard，避免它报错导致 loading 屏卡住
    if (typeof renderDashboard === 'function') {
      renderDashboard();
    } else {
      console.error('[initApp] renderDashboard 未定义！');
    }

    // 更新 PC 侧边栏激活状态
    document.querySelectorAll('.nav-item').forEach(function(item) {
      item.classList.toggle('active', item.dataset.page === 'dashboard');
    });
    // 更新手机端底部导航
    document.querySelectorAll('.mobile-nav-item').forEach(function(item) {
      item.classList.toggle('active', item.dataset.page === 'dashboard');
    });
    if (typeof updateBackBtn === 'function') updateBackBtn();

    // 隐藏加载画面（本地数据已渲染，立即可见）
    if (loadingEl) {
      loadingEl.style.opacity = '0';
      loadingEl.style.transition = 'opacity 0.3s';
      setTimeout(function() {
        if (loadingEl) loadingEl.style.display = 'none';
        clearTimeout(safetyTimer); // 正常隐藏后取消安全网
      }, 300);
    }

    // 第二步：云端同步放到 setTimeout 后台执行，绝不阻塞 UI
    setTimeout(function() { backgroundSync(s); }, 100);

  } catch (e) {
    console.error('[initApp] 初始化异常：', e);
    // 立刻隐藏 loading 屏
    if (loadingEl) loadingEl.style.display = 'none';
    clearTimeout(safetyTimer);
    showToast('页面部分加载异常，但您仍可正常使用', 'warning', 4000);
  }
}

// 后台云端同步（不阻塞 UI 初始化）
async function backgroundSync(s) {
  try {
    var savedConfig = s && s.firebaseConfig;
    if (!savedConfig || !savedConfig.apiKey) {
      // 未配置 Firebase，跳过云同步');
      return;
    }
    window.APP_FIREBASE_CONFIG = savedConfig;
    var success = await initFirebase();
    if (!success) {
      // Firebase 初始化失败');
      var statusEl = document.getElementById('sync-status');
      if (statusEl) statusEl.textContent = '⚠️ 云同步未配置';
      return;
    }
    // 正在从云端加载数据...');
    var cloudData = await loadFromCloud();
    if (cloudData) {
      // 云端有数据，应用云端数据');
      window.APP.db = normalizeDB(cloudData);
      saveDB_localOnly();
      if (typeof renderDashboard === 'function') renderDashboard();
      showToast('✅ 已同步云端数据（' + (cloudData.customers ? cloudData.customers.length : 0) + ' 条客户）', 'success', 3000);
    } else {
      // 云端暂无数据，将本地数据推送到云端');
      await saveToCloud(window.APP.db);
    }
    listenCloudChanges();
    statusEl = document.getElementById('sync-status');
    if (statusEl) statusEl.textContent = '☁️ 已连接';
  } catch (e) {
    // 后台同步失败（不影响本地使用）：', e.message);
  }
}

// ==================== Firebase 配置更新（从系统设置保存后调用）====================
async function refreshFirebaseConfig() {
  const s = window.APP.db && window.APP.db.settings;
  if (s && s.firebaseConfig) {
    window.APP_FIREBASE_CONFIG = s.firebaseConfig;
    const success = initFirebase(); // REST API 同步初始化
    if (success) {
      startCloudPolling();
      showToast('Firebase 已连接，正在同步数据…', 'info', 3000);
    }
  }
}

// ==================== 主题管理（v3.4.0）====================
function applyTheme() {
  const theme = (window.APP.db && window.APP.db.settings && window.APP.db.settings.theme) || 'dark';
  const root = document.documentElement;

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }

  // 更新主题图标（桌面端和移动端）
  const iconMap = { dark: '🌙', light: '☀️', system: '🖥️' };
  const icon = iconMap[theme] || '🖥️';
  var el = document.getElementById('theme-toggle-icon');
  if (el) el.textContent = icon;
  el = document.getElementById('theme-toggle-icon-dt');
  if (el) el.textContent = icon;
}

function saveTheme(theme) {
  window.APP.db.settings.theme = theme;
  saveDB();
  applyTheme();
  showToast('主题已切换');
}

// 监听系统主题变化（跟随系统模式时）
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if ((window.APP.db && window.APP.db.settings && window.APP.db.settings.theme) === 'system') {
    applyTheme();
  }
});

// 快捷循环切换（深色→浅色→系统→深色）
function cycleTheme() {
  const themes = ['dark', 'light', 'system'];
  const current = (window.APP.db && window.APP.db.settings && window.APP.db.settings.theme) || 'dark';
  const idx = themes.indexOf(current);
  const next = themes[(idx + 1) % themes.length];
  saveTheme(next);
}
