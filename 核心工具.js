/**
 * 核心工具.js - 销售客户管理系统 v3.0.0
 * 职责：数据存储、工具函数、全局状态、初始化
 */

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
      customerSources: ['微信群', '朋友推荐', '网络广告', '老客户介绍', '其他']
    },
    productDisplayData: {},
    version: '3.0.0'
  };
}

// ==================== 预设商品 ====================
const DEFAULT_PRODUCTS = [
  { name: '路通月卡(打卡，安卓系统使用，一机一码，操作需要规范)', type: 'software', price: 80, cost: 7 },
  { name: '路通半年(打卡，安卓系统使用，一机一码，操作需要规范)', type: 'software', price: 150, cost: 38 },
  { name: '路通年卡(打卡，安卓系统使用，一机一码，操作需要规范)', type: 'software', price: 268, cost: 89 },
  { name: '蓝牙打卡(只限手机连接考勤机蓝牙打卡使用，顺丰包邮)', type: 'hardware', price: 288, cost: 100 },
  { name: 'iphone15以上C口(全局修改定位，不绑定手机，永久使用，安全稳定，顺丰包邮)', type: 'hardware', price: 288, cost: 110 },
  { name: 'iphone14以下L口(全局修改定位，不绑定手机，永久使用，安全稳定，顺丰包邮)', type: 'hardware', price: 288, cost: 150 },
  { name: 'iphone全系列CL双口(全局修改定位，不绑定手机，永久使用，安全稳定，顺丰包邮)', type: 'hardware', price: 388, cost: 200 }
];

// ==================== 数据加载/保存 ====================
function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      // 兼容老版本数据，补全缺失字段
      if (!data.settings) data.settings = getEmptyDB().settings;
      if (!data.cardRecords) data.cardRecords = [];
      if (!data.productDisplayData) data.productDisplayData = {};
      window.APP.db = data;
    } else {
      window.APP.db = getEmptyDB();
      initDefaultData();
    }
  } catch (e) {
    console.error('数据加载失败', e);
    window.APP.db = getEmptyDB();
    initDefaultData();
  }
}

function saveDB() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(window.APP.db));
  } catch (e) {
    console.error('数据保存失败', e);
    showToast('数据保存失败，存储空间可能不足', 'error');
  }
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
    case 'monthly': d.setDate(d.getDate() + 30); break;
    case 'quarterly': d.setDate(d.getDate() + 90); break;
    case 'halfyear': d.setDate(d.getDate() + 180); break;
    case 'yearly': d.setDate(d.getDate() + 365); break;
    case 'permanent': d.setFullYear(d.getFullYear() + 10); break;
    default: return '';
  }
  return formatDate(d, 'YYYY-MM-DD');
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
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);';
  overlay.innerHTML = `
    <div id="modal-box" class="modal-box" style="border-radius:12px;width:${sizeMap[size]||'600px'};max-width:95vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);">
        <h3 style="color:var(--text-primary);font-size:16px;font-weight:600;margin:0;">${title}</h3>
        <button onclick="closeModal()" style="background:none;border:none;color:var(--text-secondary);font-size:20px;cursor:pointer;line-height:1;padding:0 4px;">&times;</button>
      </div>
      <div id="modal-body" style="padding:20px;overflow-y:auto;flex:1;">${content}</div>
      ${footer ? `<div style="padding:16px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;">${footer}</div>` : ''}
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}

function closeModal() {
  const el = document.getElementById('modal-overlay');
  if (el) el.remove();
}

// ==================== 确认弹窗 ====================
function confirmDialog(msg, onConfirm, title = '确认操作') {
  showModal(title, `<p style="color:#cbd5e1;font-size:15px;line-height:1.6;">${msg}</p>`,
    `<button onclick="closeModal()" class="btn-secondary">取消</button>
     <button onclick="(${onConfirm.toString()})();closeModal();" class="btn-danger">确认</button>`
  );
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
  let html = `<div class="pager">`;
  html += `<button ${pager.page <= 1 ? 'disabled' : ''} onclick="(${onPage.toString()})(${pager.page - 1})">上一页</button>`;
  for (let i = 1; i <= pager.totalPages; i++) {
    if (i === 1 || i === pager.totalPages || Math.abs(i - pager.page) <= 2) {
      html += `<button class="${i === pager.page ? 'active' : ''}" onclick="(${onPage.toString()})(${i})">${i}</button>`;
    } else if (Math.abs(i - pager.page) === 3) {
      html += `<span>...</span>`;
    }
  }
  html += `<button ${pager.page >= pager.totalPages ? 'disabled' : ''} onclick="(${onPage.toString()})(${pager.page + 1})">下一页</button>`;
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
  if (fn) fn();
}

// ==================== 初始化入口 ====================
function initApp() {
  loadDB();
  // 应用设置
  const s = window.APP.db.settings;
  if (s.siteName) {
    document.title = s.siteName;
    const titleEl = document.getElementById('site-title');
    if (titleEl) titleEl.textContent = s.siteName;
  }
  if (s.siteLogo) {
    const logoEl = document.getElementById('site-logo');
    if (logoEl) { logoEl.src = s.siteLogo; logoEl.style.display = 'block'; }
  }
  // 应用主题
  applyTheme();
  navigateTo('dashboard');
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
