// ============================================================
// 数据存储层
// ============================================================
const DB = {
  get(key, def) {
    if (def === undefined) def = [];
    try { const v = localStorage.getItem('crm_' + key); return v !== null ? JSON.parse(v) : def; }
    catch (e) { return def; }
  },
  set(key, val) {
    try { localStorage.setItem('crm_' + key, JSON.stringify(val)); }
    catch (e) { toast('存储失败：' + e.message, 'error'); }
  }
};

function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }
function nowISO() { return new Date().toISOString(); }
function fmtDate(d) { if (!d) return ''; try { return d.substr(0, 10); } catch (e) { return ''; } }
function pad(n) { return String(n).padStart(2, '0'); }
function genOrderNo(prefix) {
  const d = new Date();
  return prefix + String(d.getFullYear()).substr(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes()) + Math.random().toString(36).substr(2, 4).toUpperCase();
}
function todayStr() { return new Date().toISOString().split('T')[0]; }

// ============================================================
// 初始化默认数据
// ============================================================
function initDefaultData() {
  if (localStorage.getItem('crm_inited')) return;
  DB.set('products', [
    { id: genId(), name: '蓝牙打卡设备', type: '硬件', subtype: '蓝牙', status: '启用', createdAt: nowISO() },
    { id: genId(), name: 'GPS定位器', type: '硬件', subtype: '定位', status: '启用', createdAt: nowISO() },
    { id: genId(), name: '软件激活码-月卡', type: '软件', subtype: '月卡', status: '启用', createdAt: nowISO() },
    { id: genId(), name: '年度会员', type: '软件', subtype: '年卡', status: '启用', createdAt: nowISO() },
  ]);
  DB.set('brands', ['苹果', '华为', '小米', 'OPPO', 'vivo', '三星', '一加', '荣耀', '魅族', '其他']);
  DB.set('sw_tpl', {
    content: `🎉 您的订单信息\n━━━━━━━━━━━━━━\n产品：{产品名称}\n卡密：{卡密}\n数量：{购买数量}\n金额：{金额}元\n购买日期：{购买日期}\n有效期至：{到期日期}\n━━━━━━━━━━━━━━\n⚠️ {提示语}`,
    tips: '请妥善保管卡密信息，不要泄露给他人。'
  });
  DB.set('hw_tpl', {
    content: `📦 硬件订单信息\n━━━━━━━━━━━━━━\n产品：{产品名称}\n数量：{数量}\n金额：{金额}元\n订单号：{订单号}\n快递公司：{快递公司}\n快递单号：{快递单号}\n━━━━━━━━━━━━━━\n💡 {提示语}`,
    tips: '感谢您的购买，如有问题请联系客服。'
  });
  DB.set('settings', { sysName: '销售客户管理系统', defaultExpress: '' });
  DB.set('custom_fields', []);
  DB.set('customers', []);
  DB.set('sw_orders', []);
  DB.set('hw_orders', []);
  DB.set('keycodes', []);
  localStorage.setItem('crm_inited', '1');
}

// ============================================================
// Toast 通知
// ============================================================
function toast(msg, type) {
  type = type || 'success';
  const c = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = 'toast-item ' + type;
  const icons = { success: '✅', error: '❌', warning: '⚠️' };
  el.innerHTML = (icons[type] || 'ℹ️') + ' ' + msg;
  c.appendChild(el);
  setTimeout(function () { el.remove(); }, 3000);
}

// ============================================================
// 导航路由
// ============================================================
const PAGE_TITLES = {
  dashboard: '工作台', customers: '客户管理', 'sw-orders': '软件订单',
  'hw-orders': '硬件订单', products: '商品管理', keycodes: '卡密管理',
  settings: '系统设置', 'data-mgr': '数据备份'
};

function navigateTo(page) {
  // 隐藏所有页面
  document.querySelectorAll('.page-section').forEach(function (p) { p.style.display = 'none'; });
  // 取消所有导航项的激活状态
  document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
  document.querySelectorAll('.mobile-nav-item').forEach(function (n) { n.classList.remove('active'); });
  // 显示目标页面
  const pg = document.getElementById('page-' + page);
  if (pg) pg.style.display = 'block';
  // 激活对应导航项
  const link = document.querySelector('[data-page="' + page + '"]');
  if (link) link.classList.add('active');
  // 页面切换时调用对应的渲染函数
  const fns = {
    dashboard: renderDashboard, customers: renderCustomers,
    orders: renderOrders, cards: renderCards,
    products: renderProducts, stats: renderStats,
    settings: renderSettings
  };
  if (fns[page]) {
    try { fns[page](); } catch (e) { console.error(page + ' render error:', e); }
  }
}

// tab切换（通过事件委托，支持动态内容）
document.addEventListener('click', function (e) {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  const nav = btn.closest('.tab-nav');
  if (!nav) return;
  nav.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
  btn.classList.add('active');
  const contentContainer = nav.parentElement;
  contentContainer.querySelectorAll('.tab-content').forEach(function (tc) { tc.classList.add('hidden'); });
  const target = contentContainer.querySelector('#tab-' + btn.dataset.tab);
  if (target) target.classList.remove('hidden');
});

// ============================================================
// 模态框
// ============================================================
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('.modal-overlay').forEach(function (o) {
  o.addEventListener('click', function (e) { if (e.target === o) o.classList.remove('show'); });
});

// ============================================================
// 初始化应用
// ============================================================
function initApp() {
  // 初始化默认数据
  initDefaultData();
  // 显示工作台
  navigateTo('dashboard');
  // 渲染工作台内容
  if (typeof renderDashboard === 'function') {
    try { renderDashboard(); } catch (e) { console.error('Dashboard render error:', e); }
  }
}

// ============================================================
// 分页
// ============================================================
const PAGE_SIZE = 15;
function renderPagination(containerId, total, current, callbackName) {
  const c = document.getElementById(containerId);
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) { c.innerHTML = ''; return; }
  let html = '';
  html += '<button ' + (current <= 1 ? 'disabled' : '') + ' onclick="' + callbackName + '(' + (current - 1) + ')">‹</button>';
  for (let i = 1; i <= pages; i++) {
    if (pages > 7 && i > 2 && i < pages - 1 && Math.abs(i - current) > 1) {
      if (i === 3 || i === pages - 2) html += '<button disabled>…</button>';
      continue;
    }
    html += '<button class="' + (i === current ? 'active' : '') + '" onclick="' + callbackName + '(' + i + ')">' + i + '</button>';
  }
  html += '<button ' + (current >= pages ? 'disabled' : '') + ' onclick="' + callbackName + '(' + (current + 1) + ')">›</button>';
  c.innerHTML = html;
}

// ============================================================
// 复制工具
// ============================================================
function copyText(text, label) {
  try {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () {
        toast((label || '内容') + '已复制到剪贴板');
      }).catch(function () { fallbackCopy(text, label); });
    } else { fallbackCopy(text, label); }
  } catch (e) { fallbackCopy(text, label); }
}
function fallbackCopy(text, label) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  try {
    document.execCommand('copy');
    toast((label || '内容') + '已复制到剪贴板');
  } catch (e) {
    toast('复制失败，请手动复制', 'error');
  }
  document.body.removeChild(el);
}

// ============================================================
// 工作台
// ============================================================
function renderDashboard() {
  const customers = DB.get('customers');
  const swOrders = DB.get('sw_orders');
  const hwOrders = DB.get('hw_orders');
  const today = todayStr();
  const expiring = swOrders.filter(function (o) {
    if (!o.endDate) return false;
    const d = (new Date(o.endDate) - new Date(today)) / 86400000;
    return d >= 0 && d <= 30;
  });
  const totalAmt = swOrders.concat(hwOrders).reduce(function (s, o) { return s + (parseFloat(o.amount) || 0); }, 0);
  const todayOrders = swOrders.concat(hwOrders).filter(function (o) { return (o.createdAt || '').substr(0, 10) === today; });

  document.getElementById('stats-grid').innerHTML = [
    ['👥 客户总数', customers.length, '累计客户'],
    ['💿 软件订单', swOrders.length, '累计'],
    ['🔌 硬件订单', hwOrders.length, '累计'],
    ['💰 总收入', '¥' + totalAmt.toFixed(2), '所有订单'],
    ['📅 今日新增', todayOrders.length, '今日'],
    ['⏰ 即将到期', expiring.length, '30天内'],
  ].map(function (s) {
    return '<div class="stat-card"><div class="label">' + s[0] + '</div><div class="value" style="font-size:' + (s[0] === '💰 总收入' ? '20px' : '26px') + '">' + s[1] + '</div><div class="sub">' + s[2] + '</div></div>';
  }).join('');

  const recentSw = swOrders.slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }).slice(0, 5);
  document.getElementById('recent-sw').innerHTML = recentSw.length
    ? '<table style="width:100%"><thead><tr><th>客户</th><th>商品</th><th>金额</th><th>到期日</th></tr></thead><tbody>' +
    recentSw.map(function (o) { return '<tr><td>' + getCustName(o.customerId) + '</td><td>' + (o.productName || '-') + '</td><td>¥' + (o.amount || 0) + '</td><td>' + (o.endDate || '-') + '</td></tr>'; }).join('') + '</tbody></table>'
    : '<div class="empty-state"><div>暂无数据</div></div>';

  const recentHw = hwOrders.slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }).slice(0, 5);
  document.getElementById('recent-hw').innerHTML = recentHw.length
    ? '<table style="width:100%"><thead><tr><th>客户</th><th>商品</th><th>金额</th><th>物流单号</th></tr></thead><tbody>' +
    recentHw.map(function (o) { return '<tr><td>' + getCustName(o.customerId) + '</td><td>' + (o.productName || '-') + '</td><td>¥' + (o.amount || 0) + '</td><td>' + (o.expressNo || '-') + '</td></tr>'; }).join('') + '</tbody></table>'
    : '<div class="empty-state"><div>暂无数据</div></div>';

  document.getElementById('expiring-list').innerHTML = expiring.length
    ? '<table style="width:100%"><thead><tr><th>客户</th><th>商品</th><th>卡密</th><th>到期日期</th><th>剩余天数</th></tr></thead><tbody>' +
    expiring.map(function (o) {
      const days = Math.ceil((new Date(o.endDate) - new Date(today)) / 86400000);
      return '<tr><td>' + getCustName(o.customerId) + '</td><td>' + (o.productName || '') + '</td><td><span class="key-tag">' + (o.keyContent || '-') + '</span></td><td>' + o.endDate + '</td><td><span class="badge ' + (days <= 7 ? 'badge-red' : 'badge-yellow') + '">' + days + '天</span></td></tr>';
    }).join('') + '</tbody></table>'
    : '<div class="empty-state"><div>暂无即将到期订单 🎉</div></div>';
}

// ============================================================
// 客户管理
// ============================================================
let custPage = 1;

function renderCustomers() {
  const all = DB.get('customers');
  const q = (document.getElementById('cust-search').value || '').toLowerCase();
  const src = document.getElementById('cust-source-filter').value || '';

  // 刷新来源下拉
  const sources = Array.from(new Set(all.map(function (c) { return c.source; }).filter(Boolean)));
  const srcEl = document.getElementById('cust-source-filter');
  const curSrc = srcEl.value;
  srcEl.innerHTML = '<option value="">全部来源</option>' + sources.map(function (s) { return '<option value="' + s + '" ' + (s === curSrc ? 'selected' : '') + '>' + s + '</option>'; }).join('');

  let list = all.filter(function (c) {
    const match = !q || (c.wechatName || '').toLowerCase().includes(q) || (c.wechatId || '').toLowerCase().includes(q) || (c.phone || '').includes(q);
    return match && (!src || c.source === src);
  }).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

  renderPagination('cust-page', list.length, custPage, 'goCustPage');
  const pageList = list.slice((custPage - 1) * PAGE_SIZE, custPage * PAGE_SIZE);
  const tbody = document.getElementById('cust-tbody');

  if (!pageList.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="icon">👥</div><div>暂无客户数据</div></div></td></tr>';
    return;
  }
  tbody.innerHTML = pageList.map(function (c, i) {
    const wid = (c.wechatId || '').replace(/'/g, "\\'");
    return '<tr><td>' + ((custPage - 1) * PAGE_SIZE + i + 1) + '</td>' +
      '<td>' + (c.wechatName || '-') + '</td>' +
      '<td>' + (c.wechatId || '-') + (c.wechatId ? ' <button class="copy-btn" onclick="copyText(\'' + wid + '\',\'微信号\')">复制</button>' : '') + '</td>' +
      '<td>' + (c.phone || '-') + '</td>' +
      '<td>' + (c.source || '-') + '</td>' +
      '<td style="max-width:120px;overflow:hidden;text-overflow:ellipsis" title="' + (c.remark || '') + '">' + (c.remark || '-') + '</td>' +
      '<td>' + fmtDate(c.createdAt) + '</td>' +
      '<td><div class="action-row"><button class="btn btn-outline btn-xs" onclick="openCustomerModal(\'' + c.id + '\')">编辑</button><button class="btn btn-danger btn-xs" onclick="deleteCustomer(\'' + c.id + '\')">删除</button></div></td>' +
      '</tr>';
  }).join('');
}
function goCustPage(p) { custPage = p; renderCustomers(); }

function openCustomerModal(id) {
  const c = id ? DB.get('customers').find(function (x) { return x.id === id; }) : null;
  document.getElementById('modal-customer-title').textContent = c ? '编辑客户' : '新增客户';
  document.getElementById('cust-wechat-name').value = c ? (c.wechatName || '') : '';
  document.getElementById('cust-wechat-id').value = c ? (c.wechatId || '') : '';
  document.getElementById('cust-phone').value = c ? (c.phone || '') : '';
  document.getElementById('cust-source').value = c ? (c.source || '') : '';
  document.getElementById('cust-remark').value = c ? (c.remark || '') : '';
  document.getElementById('modal-customer').dataset.editId = id || '';
  openModal('modal-customer');
}

function saveCustomer() {
  const wechatName = document.getElementById('cust-wechat-name').value.trim();
  const wechatId = document.getElementById('cust-wechat-id').value.trim();
  if (!wechatName) { toast('请填写微信名', 'error'); return; }
  if (!wechatId) { toast('请填写微信号', 'error'); return; }
  const editId = document.getElementById('modal-customer').dataset.editId;
  const list = DB.get('customers');
  const data = {
    wechatName: wechatName, wechatId: wechatId,
    phone: document.getElementById('cust-phone').value.trim(),
    source: document.getElementById('cust-source').value.trim(),
    remark: document.getElementById('cust-remark').value.trim()
  };
  if (editId) {
    const idx = list.findIndex(function (x) { return x.id === editId; });
    if (idx >= 0) list[idx] = Object.assign({}, list[idx], data);
  } else {
    list.push(Object.assign({ id: genId(), createdAt: nowISO() }, data));
  }
  DB.set('customers', list);
  closeModal('modal-customer');
  toast(editId ? '客户信息已更新' : '客户新增成功');
  renderCustomers();
}

function deleteCustomer(id) {
  if (!confirm('确认删除该客户？')) return;
  DB.set('customers', DB.get('customers').filter(function (c) { return c.id !== id; }));
  toast('已删除');
  renderCustomers();
}

function getCustName(id) {
  const c = DB.get('customers').find(function (x) { return x.id === id; });
  return c ? c.wechatName : '未知客户';
}
function getCust(id) {
  return DB.get('customers').find(function (x) { return x.id === id; });
}

// ============================================================
// 快速新增客户（在订单中）
// ============================================================
let quickCustTarget = ''; // 'sw' or 'hw'

function openQuickAddCustomer(target) {
  quickCustTarget = target;
  document.getElementById('qc-wechat-name').value = '';
  document.getElementById('qc-wechat-id').value = '';
  document.getElementById('qc-phone').value = '';
  document.getElementById('qc-source').value = '';
  openModal('modal-quick-customer');
}

function saveQuickCustomer() {
  const wechatName = document.getElementById('qc-wechat-name').value.trim();
  const wechatId = document.getElementById('qc-wechat-id').value.trim();
  if (!wechatName) { toast('请填写微信名', 'error'); return; }
  if (!wechatId) { toast('请填写微信号', 'error'); return; }
  const list = DB.get('customers');
  const newCust = {
    id: genId(), wechatName: wechatName, wechatId: wechatId,
    phone: document.getElementById('qc-phone').value.trim(),
    source: document.getElementById('qc-source').value.trim(),
    remark: '', createdAt: nowISO()
  };
  list.push(newCust);
  DB.set('customers', list);
  closeModal('modal-quick-customer');
  toast('客户新增成功，已自动选中');
  // 自动选中该客户
  const target = quickCustTarget;
  document.getElementById(target + '-cust-input').value = newCust.wechatName;
  document.getElementById(target + '-cust-id').value = newCust.id;
  const infoEl = document.getElementById(target + '-cust-info');
  const infoText = document.getElementById(target + '-cust-info-text');
  if (infoEl && infoText) {
    infoText.textContent = '👤 ' + newCust.wechatName + '  |  微信号：' + newCust.wechatId + '  |  手机：' + (newCust.phone || '未填写');
    infoEl.classList.remove('hidden');
  }
}

// ============================================================
// 下拉搜索组件 - 客户
// ============================================================
function dsSearch(type) {
  const input = document.getElementById(type + '-input');
  const q = (input.value || '').toLowerCase();
  const listEl = document.getElementById('ds-' + type + '-list');
  const customers = DB.get('customers');
  const filtered = customers.filter(function (c) {
    return (c.wechatName || '').toLowerCase().includes(q) ||
      (c.wechatId || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q);
  }).slice(0, 25);

  if (!filtered.length) {
    listEl.innerHTML = '<div class="ds-empty">未找到客户，可点击"新增客户"</div>';
  } else {
    listEl.innerHTML = filtered.map(function (c) {
      return '<div class="ds-item" data-id="' + c.id + '" onmousedown="dsSelect(\'' + type + '\',\'' + c.id + '\')">' +
        '<strong>' + (c.wechatName || '') + '</strong> <span style="color:var(--text2);font-size:12px">' +
        (c.wechatId || '') + (c.phone ? ' · ' + c.phone : '') + '</span></div>';
    }).join('');
  }
  listEl.classList.add('show');
}

function dsOpen(type) {
  const q = document.getElementById(type + '-input').value;
  if (q) { dsSearch(type); return; }
  const listEl = document.getElementById('ds-' + type + '-list');
  const customers = DB.get('customers').slice(0, 25);
  if (!customers.length) {
    listEl.innerHTML = '<div class="ds-empty">暂无客户，请先新增</div>';
  } else {
    listEl.innerHTML = customers.map(function (c) {
      return '<div class="ds-item" data-id="' + c.id + '" onmousedown="dsSelect(\'' + type + '\',\'' + c.id + '\')">' +
        '<strong>' + (c.wechatName || '') + '</strong> <span style="color:var(--text2);font-size:12px">' +
        (c.wechatId || '') + (c.phone ? ' · ' + c.phone : '') + '</span></div>';
    }).join('');
  }
  listEl.classList.add('show');
}

function dsBlur(type) {
  setTimeout(function () {
    const el = document.getElementById('ds-' + type + '-list');
    if (el) el.classList.remove('show');
  }, 200);
}

function dsSelect(type, custId) {
  const c = DB.get('customers').find(function (x) { return x.id === custId; });
  if (!c) return;
  const prefix = type.replace('-cust', '');
  document.getElementById(type + '-input').value = c.wechatName;
  const hidEl = document.getElementById(prefix + '-cust-id');
  if (hidEl) hidEl.value = custId;
  document.getElementById('ds-' + type + '-list').classList.remove('show');
  const infoEl = document.getElementById(prefix + '-cust-info');
  const infoText = document.getElementById(prefix + '-cust-info-text');
  if (infoEl && infoText) {
    infoText.textContent = '👤 ' + c.wechatName + '  |  微信号：' + c.wechatId + '  |  手机：' + (c.phone || '未填写') + '  |  来源：' + (c.source || '未填写');
    infoEl.classList.remove('hidden');
  }
}

// ============================================================
// 下拉搜索 - 卡密
// ============================================================
function dsKeySearch() {
  const q = (document.getElementById('sw-key-input').value || '').toLowerCase();
  const typeFilter = (document.getElementById('sw-key-type') ? document.getElementById('sw-key-type').value : '') || '';
  const listEl = document.getElementById('ds-sw-key-list');
  const keys = DB.get('keycodes').filter(function (k) { return k.status !== '已使用'; });

  let filtered = keys.filter(function (k) {
    const matchQ = !q || (k.content || '').toLowerCase().includes(q) || (k.productName || '').toLowerCase().includes(q) || (k.keyType || '').toLowerCase().includes(q);
    const matchType = !typeFilter || k.keyType === typeFilter;
    return matchQ && matchType;
  }).slice(0, 30);

  if (!filtered.length) {
    const manualHtml = q ? '<div class="ds-item" onmousedown="dsKeySelectManual()">✏️ 直接使用：<strong>' + escHtml(q) + '</strong>（手动输入）</div>' : '';
    listEl.innerHTML = manualHtml + '<div class="ds-empty">库中无匹配未使用卡密</div>';
  } else {
    listEl.innerHTML = filtered.map(function (k) {
      return '<div class="ds-item" onmousedown="dsKeySelect(\'' + k.id + '\')">' +
        '<span class="key-tag">' + escHtml(k.content) + '</span>' +
        '<span style="margin-left:6px;font-size:11px;color:var(--text2)">' + (k.keyType || '') + (k.productName ? ' · ' + k.productName : '') + '</span></div>';
    }).join('');
  }
  listEl.classList.add('show');
}

function dsKeyOpen() {
  const typeFilter = document.getElementById('sw-key-type') ? document.getElementById('sw-key-type').value : '';
  const keys = DB.get('keycodes').filter(function (k) {
    return k.status !== '已使用' && (!typeFilter || k.keyType === typeFilter);
  }).slice(0, 30);
  const listEl = document.getElementById('ds-sw-key-list');
  if (!keys.length) {
    listEl.innerHTML = '<div class="ds-empty">暂无可用卡密（可手动输入）</div>';
  } else {
    listEl.innerHTML = keys.map(function (k) {
      return '<div class="ds-item" onmousedown="dsKeySelect(\'' + k.id + '\')">' +
        '<span class="key-tag">' + escHtml(k.content) + '</span>' +
        '<span style="margin-left:6px;font-size:11px;color:var(--text2)">' + (k.keyType || '') + (k.productName ? ' · ' + k.productName : '') + '</span></div>';
    }).join('');
  }
  listEl.classList.add('show');
}

function dsKeyBlur() {
  setTimeout(function () {
    const el = document.getElementById('ds-sw-key-list');
    if (el) el.classList.remove('show');
  }, 200);
}

function dsKeySelect(keyId) {
  const k = DB.get('keycodes').find(function (x) { return x.id === keyId; });
  if (!k) return;
  document.getElementById('sw-key-input').value = k.content;
  document.getElementById('sw-key-id').value = k.id;
  document.getElementById('ds-sw-key-list').classList.remove('show');
  const infoEl = document.getElementById('sw-key-selected-info');
  infoEl.textContent = '✅ 已从卡密库选择：' + k.content + ' | 类型：' + (k.keyType || '未知') + ' | 状态：' + k.status;
  infoEl.classList.remove('hidden');
  if (k.keyType) { const sel = document.getElementById('sw-key-type'); if (sel) sel.value = k.keyType; }
}

function dsKeySelectManual() {
  const content = document.getElementById('sw-key-input').value.trim();
  document.getElementById('sw-key-id').value = '';
  document.getElementById('ds-sw-key-list').classList.remove('show');
  const infoEl = document.getElementById('sw-key-selected-info');
  infoEl.textContent = '✏️ 手动输入卡密：' + content;
  infoEl.classList.remove('hidden');
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============================================================
// 软件订单
// ============================================================
let swPage = 1;
let swEditId = '';

function renderSwOrders() {
  const all = DB.get('sw_orders');
  const q = (document.getElementById('sw-search').value || '').toLowerCase();
  const statusF = document.getElementById('sw-status-filter').value || '';
  const typeF = document.getElementById('sw-type-filter').value || '';

  let list = all.filter(function (o) {
    const custName = getCustName(o.customerId).toLowerCase();
    const match = !q || custName.includes(q) || (o.productName || '').toLowerCase().includes(q) ||
      (o.keyContent || '').toLowerCase().includes(q) || (o.orderNo || '').toLowerCase().includes(q);
    return match && (!statusF || o.approvalStatus === statusF) && (!typeF || o.keyType === typeF);
  }).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

  renderPagination('sw-page', list.length, swPage, 'goSwPage');
  const pageList = list.slice((swPage - 1) * PAGE_SIZE, swPage * PAGE_SIZE);
  const tbody = document.getElementById('sw-tbody');

  if (!pageList.length) {
    tbody.innerHTML = '<tr><td colspan="12"><div class="empty-state"><div class="icon">💿</div><div>暂无软件订单</div></div></td></tr>';
    return;
  }
  const statusMap = { '已通过': 'badge-green', '待审批': 'badge-yellow', '已拒绝': 'badge-red', '请选择': 'badge-gray' };
  tbody.innerHTML = pageList.map(function (o, i) {
    const keyEsc = (o.keyContent || '').replace(/'/g, "\\'").replace(/\\/g, '\\\\');
    return '<tr>' +
      '<td>' + ((swPage - 1) * PAGE_SIZE + i + 1) + '</td>' +
      '<td style="font-size:11px;color:var(--text2)">' + (o.orderNo || '-') + '</td>' +
      '<td>' + getCustName(o.customerId) + '</td>' +
      '<td>' + (o.productName || '-') + '</td>' +
      '<td><span class="badge badge-blue">' + (o.keyType || '-') + '</span></td>' +
      '<td><div style="display:flex;align-items:center;gap:4px"><span class="key-tag" title="' + escHtml(o.keyContent || '') + '">' + escHtml(o.keyContent || '-') + '</span>' +
      (o.keyContent ? ' <button class="copy-btn" onclick="copyText(\'' + keyEsc + '\',\'卡密\')">复制</button>' : '') + '</div></td>' +
      '<td>' + (o.qty || 1) + '</td>' +
      '<td>¥' + (o.amount || 0) + '</td>' +
      '<td>' + (o.startDate || '-') + '</td>' +
      '<td>' + (o.endDate || '-') + '</td>' +
      '<td><span class="badge ' + (statusMap[o.approvalStatus] || 'badge-gray') + '">' + (o.approvalStatus || '-') + '</span></td>' +
      '<td><div class="action-row">' +
      '<button class="btn btn-outline btn-xs" onclick="openSwOrderModal(\'' + o.id + '\')">编辑</button>' +
      '<button class="btn btn-info btn-xs" onclick="openCopySwModal(\'' + o.id + '\')">复制</button>' +
      '<button class="btn btn-danger btn-xs" onclick="deleteSwOrder(\'' + o.id + '\')">删除</button>' +
      '</div></td></tr>';
  }).join('');
}
function goSwPage(p) { swPage = p; renderSwOrders(); }

function openSwOrderModal(id) {
  swEditId = id || '';
  const o = id ? DB.get('sw_orders').find(function (x) { return x.id === id; }) : null;
  document.getElementById('modal-sw-order-title').textContent = o ? '编辑软件订单' : '新增软件订单';
  // 重置客户
  document.getElementById('sw-cust-input').value = '';
  document.getElementById('sw-cust-id').value = '';
  document.getElementById('sw-cust-info').classList.add('hidden');
  // 重置卡密
  document.getElementById('sw-key-input').value = '';
  document.getElementById('sw-key-id').value = '';
  document.getElementById('sw-key-selected-info').classList.add('hidden');
  // 填充商品
  fillProductSelect('sw-product', '软件');
  // 默认日期
  document.getElementById('sw-start-date').value = todayStr();
  document.getElementById('sw-end-date').value = '';
  // 如果是编辑
  if (o) {
    const cust = getCust(o.customerId);
    if (cust) {
      document.getElementById('sw-cust-input').value = cust.wechatName;
      document.getElementById('sw-cust-id').value = cust.id;
      document.getElementById('sw-cust-info-text').textContent = '👤 ' + cust.wechatName + '  |  微信号：' + cust.wechatId + '  |  手机：' + (cust.phone || '未填写');
      document.getElementById('sw-cust-info').classList.remove('hidden');
    }
    document.getElementById('sw-product').value = o.productId || '';
    document.getElementById('sw-key-type').value = o.keyType || '';
    document.getElementById('sw-key-input').value = o.keyContent || '';
    document.getElementById('sw-key-id').value = o.keyId || '';
    if (o.keyContent) {
      document.getElementById('sw-key-selected-info').textContent = '已关联卡密：' + o.keyContent;
      document.getElementById('sw-key-selected-info').classList.remove('hidden');
    }
    document.getElementById('sw-qty').value = o.qty || 1;
    document.getElementById('sw-amount').value = o.amount || '';
    document.getElementById('sw-start-date').value = o.startDate || todayStr();
    document.getElementById('sw-end-date').value = o.endDate || '';
    document.getElementById('sw-source').value = o.source || '';
    document.getElementById('sw-approval').value = o.approvalStatus || '请选择';
    document.getElementById('sw-approval-note').value = o.approvalNote || '';
    document.getElementById('sw-remark').value = o.remark || '';
  } else {
    document.getElementById('sw-product').value = '';
    document.getElementById('sw-key-type').value = '';
    document.getElementById('sw-qty').value = 1;
    document.getElementById('sw-amount').value = '';
    document.getElementById('sw-source').value = '';
    document.getElementById('sw-approval').value = '请选择';
    document.getElementById('sw-approval-note').value = '';
    document.getElementById('sw-remark').value = '';
  }
  renderCustomFields('sw', o ? (o.customFields || {}) : {});
  openModal('modal-sw-order');
}

function saveSwOrder() {
  const custId = document.getElementById('sw-cust-id').value;
  const productSel = document.getElementById('sw-product');
  const productId = productSel.value;
  const productName = productId ? productSel.options[productSel.selectedIndex].text : '';
  const keyType = document.getElementById('sw-key-type').value;
  const keyContent = document.getElementById('sw-key-input').value.trim();
  const keyId = document.getElementById('sw-key-id').value;
  const qty = parseInt(document.getElementById('sw-qty').value) || 1;
  const amount = parseFloat(document.getElementById('sw-amount').value) || 0;
  const startDate = document.getElementById('sw-start-date').value;
  const endDate = document.getElementById('sw-end-date').value;

  if (!custId) { toast('请选择客户', 'error'); return; }
  if (!productId) { toast('请选择商品', 'error'); return; }
  if (!keyContent) { toast('请选择或输入卡密', 'error'); return; }
  if (!amount) { toast('请填写付款金额', 'error'); return; }
  if (!startDate) { toast('请填写开通日期', 'error'); return; }

  const list = DB.get('sw_orders');
  const customFields = collectCustomFields('sw');
  const data = {
    customerId: custId, productId: productId, productName: productName,
    keyType: keyType, keyContent: keyContent, keyId: keyId,
    qty: qty, amount: amount, startDate: startDate, endDate: endDate,
    source: document.getElementById('sw-source').value.trim(),
    approvalStatus: document.getElementById('sw-approval').value,
    approvalNote: document.getElementById('sw-approval-note').value.trim(),
    remark: document.getElementById('sw-remark').value.trim(),
    customFields: customFields
  };

  if (swEditId) {
    const idx = list.findIndex(function (x) { return x.id === swEditId; });
    if (idx >= 0) list[idx] = Object.assign({}, list[idx], data);
    toast('订单已更新');
  } else {
    const newOrder = Object.assign({ id: genId(), orderNo: genOrderNo('SW'), createdAt: nowISO() }, data);
    list.push(newOrder);
    // 标记卡密已使用
    if (keyId) {
      const keys = DB.get('keycodes');
      const ki = keys.findIndex(function (k) { return k.id === keyId; });
      if (ki >= 0) { keys[ki].status = '已使用'; keys[ki].orderId = newOrder.id; DB.set('keycodes', keys); }
    }
    toast('软件订单新增成功');
  }
  DB.set('sw_orders', list);
  closeModal('modal-sw-order');
  renderSwOrders();
}

function deleteSwOrder(id) {
  if (!confirm('确认删除该订单？')) return;
  const list = DB.get('sw_orders');
  const o = list.find(function (x) { return x.id === id; });
  if (o && o.keyId) {
    const keys = DB.get('keycodes');
    const ki = keys.findIndex(function (k) { return k.id === o.keyId; });
    if (ki >= 0) { keys[ki].status = '未使用'; delete keys[ki].orderId; DB.set('keycodes', keys); }
  }
  DB.set('sw_orders', list.filter(function (x) { return x.id !== id; }));
  toast('已删除');
  renderSwOrders();
}

function onSwProductChange() {
  const sel = document.getElementById('sw-product');
  const prod = DB.get('products').find(function (p) { return p.id === sel.value; });
  if (prod && prod.subtype) document.getElementById('sw-key-type').value = prod.subtype;
  dsKeySearch();
}

// 复制软件订单
let copySWOrderId = '';
function openCopySwModal(id) {
  copySWOrderId = id;
  const o = DB.get('sw_orders').find(function (x) { return x.id === id; });
  if (!o) return;
  const tpl = DB.get('sw_tpl', { content: '', tips: '' });
  const cust = getCust(o.customerId) || {};
  let text = (tpl.content || '').replace(/{产品名称}/g, o.productName || '')
    .replace(/{卡密}/g, o.keyContent || '')
    .replace(/{购买数量}/g, o.qty || 1)
    .replace(/{金额}/g, o.amount || 0)
    .replace(/{购买日期}/g, o.startDate || '')
    .replace(/{到期日期}/g, o.endDate || '')
    .replace(/{客户微信名}/g, cust.wechatName || '')
    .replace(/{客户手机}/g, cust.phone || '')
    .replace(/{提示语}/g, tpl.tips || '');
  document.getElementById('sw-copy-preview').textContent = text;
  document.getElementById('modal-copy-sw').dataset.copyText = text;
  openModal('modal-copy-sw');
}

function doCopySwOrder() {
  const text = document.getElementById('modal-copy-sw').dataset.copyText || '';
  copyText(text, '订单信息');
  closeModal('modal-copy-sw');
}

// ============================================================
// 硬件订单
// ============================================================
let hwPage = 1;
let hwEditId = '';

function renderHwOrders() {
  const all = DB.get('hw_orders');
  const q = (document.getElementById('hw-search').value || '').toLowerCase();
  const subF = document.getElementById('hw-subtype-filter').value || '';

  let list = all.filter(function (o) {
    const custName = getCustName(o.customerId).toLowerCase();
    const match = !q || custName.includes(q) || (o.productName || '').toLowerCase().includes(q) ||
      (o.serialNo || '').toLowerCase().includes(q) || (o.expressNo || '').toLowerCase().includes(q) ||
      (o.orderNo || '').toLowerCase().includes(q);
    return match && (!subF || o.subtype === subF);
  }).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

  renderPagination('hw-page', list.length, hwPage, 'goHwPage');
  const pageList = list.slice((hwPage - 1) * PAGE_SIZE, hwPage * PAGE_SIZE);
  const tbody = document.getElementById('hw-tbody');

  if (!pageList.length) {
    tbody.innerHTML = '<tr><td colspan="12"><div class="empty-state"><div class="icon">🔌</div><div>暂无硬件订单</div></div></td></tr>';
    return;
  }
  const subtypeMap = { '蓝牙': 'badge-blue', '定位': 'badge-purple' };
  tbody.innerHTML = pageList.map(function (o, i) {
    return '<tr>' +
      '<td>' + ((hwPage - 1) * PAGE_SIZE + i + 1) + '</td>' +
      '<td style="font-size:11px;color:var(--text2)">' + (o.orderNo || '-') + '</td>' +
      '<td>' + getCustName(o.customerId) + '</td>' +
      '<td>' + (o.productName || '-') + '</td>' +
      '<td><span class="badge ' + (subtypeMap[o.subtype] || 'badge-gray') + '">' + (o.subtype || '-') + '</span></td>' +
      '<td>' + (o.phoneOs || '-') + '</td>' +
      '<td>' + (o.phoneModel || '-') + '</td>' +
      '<td>' + (o.portType || '-') + '</td>' +
      '<td>' + (o.qty || 1) + '</td>' +
      '<td>¥' + (o.amount || 0) + '</td>' +
      '<td>' + (o.expressNo || '-') + '</td>' +
      '<td><div class="action-row">' +
      '<button class="btn btn-outline btn-xs" onclick="openHwOrderModal(\'' + o.id + '\')">编辑</button>' +
      '<button class="btn btn-info btn-xs" onclick="openCopyHwModal(\'' + o.id + '\')">复制</button>' +
      '<button class="btn btn-danger btn-xs" onclick="deleteHwOrder(\'' + o.id + '\')">删除</button>' +
      '</div></td></tr>';
  }).join('');
}
function goHwPage(p) { hwPage = p; renderHwOrders(); }

function openHwOrderModal(id) {
  hwEditId = id || '';
  const o = id ? DB.get('hw_orders').find(function (x) { return x.id === id; }) : null;
  document.getElementById('modal-hw-order-title').textContent = o ? '编辑硬件订单' : '新增硬件订单';
  document.getElementById('hw-cust-input').value = '';
  document.getElementById('hw-cust-id').value = '';
  document.getElementById('hw-cust-info').classList.add('hidden');
  fillProductSelect('hw-product', '硬件');
  fillBrandSelect();
  document.getElementById('hw-bt-section').classList.add('hidden');
  document.getElementById('port-hint').style.display = 'none';
  const today = todayStr();
  const settings = DB.get('settings', {});

  if (o) {
    const cust = getCust(o.customerId);
    if (cust) {
      document.getElementById('hw-cust-input').value = cust.wechatName;
      document.getElementById('hw-cust-id').value = cust.id;
      document.getElementById('hw-cust-info-text').textContent = '👤 ' + cust.wechatName + '  |  微信号：' + cust.wechatId + '  |  手机：' + (cust.phone || '未填写');
      document.getElementById('hw-cust-info').classList.remove('hidden');
    }
    setVal('hw-product', o.productId || '');
    setVal('hw-subtype', o.subtype || '');
    onHwSubtypeChange();
    setVal('hw-qty', o.qty || 1);
    setVal('hw-amount', o.amount || '');
    setVal('hw-start-date', o.startDate || today);
    setVal('hw-end-date', o.endDate || '');
    setVal('hw-source', o.source || '');
    setVal('hw-serial', o.serialNo || '');
    setVal('hw-express-company', o.expressCompany || '');
    setVal('hw-express-no', o.expressNo || '');
    setVal('hw-phone-os', o.phoneOs || '');
    setVal('hw-phone-brand', o.phoneBrand || '');
    setVal('hw-phone-model', o.phoneModel || '');
    setVal('hw-port-type', o.portType || '');
    setVal('hw-bt-name', o.btName || '');
    setVal('hw-bt-mac', o.btMac || '');
    setVal('hw-bt-pin', o.btPin || '');
    setVal('hw-bt-note', o.btNote || '');
    setVal('hw-remark', o.remark || '');
  } else {
    setVal('hw-product', '');
    setVal('hw-subtype', '');
    setVal('hw-qty', 1);
    setVal('hw-amount', '');
    setVal('hw-start-date', today);
    setVal('hw-end-date', '');
    setVal('hw-source', '');
    setVal('hw-serial', '');
    setVal('hw-express-company', settings.defaultExpress || '');
    setVal('hw-express-no', '');
    setVal('hw-phone-os', '');
    setVal('hw-phone-brand', '');
    setVal('hw-phone-model', '');
    setVal('hw-port-type', '');
    setVal('hw-bt-name', '');
    setVal('hw-bt-mac', '');
    setVal('hw-bt-pin', '');
    setVal('hw-bt-note', '');
    setVal('hw-remark', '');
  }
  renderCustomFields('hw', o ? (o.customFields || {}) : {});
  openModal('modal-hw-order');
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function onHwSubtypeChange() {
  const val = document.getElementById('hw-subtype').value;
  const btSection = document.getElementById('hw-bt-section');
  if (val === '蓝牙') btSection.classList.remove('hidden');
  else btSection.classList.add('hidden');
}

function onHwProductChange() {
  const sel = document.getElementById('hw-product');
  const prod = DB.get('products').find(function (p) { return p.id === sel.value; });
  if (prod && prod.subtype) {
    document.getElementById('hw-subtype').value = prod.subtype;
    onHwSubtypeChange();
  }
}

function saveHwOrder() {
  const custId = document.getElementById('hw-cust-id').value;
  const productSel = document.getElementById('hw-product');
  const productId = productSel.value;
  const productName = productId ? productSel.options[productSel.selectedIndex].text : '';
  const subtype = document.getElementById('hw-subtype').value;
  const qty = parseInt(document.getElementById('hw-qty').value) || 1;
  const amount = parseFloat(document.getElementById('hw-amount').value) || 0;

  if (!custId) { toast('请选择客户', 'error'); return; }
  if (!productId) { toast('请选择商品', 'error'); return; }
  if (!subtype) { toast('请选择尾插类型', 'error'); return; }
  if (!amount) { toast('请填写付款金额', 'error'); return; }

  const list = DB.get('hw_orders');
  const customFields = collectCustomFields('hw');
  const data = {
    customerId: custId, productId: productId, productName: productName, subtype: subtype,
    qty: qty, amount: amount,
    startDate: document.getElementById('hw-start-date').value,
    endDate: document.getElementById('hw-end-date').value,
    source: document.getElementById('hw-source').value.trim(),
    serialNo: document.getElementById('hw-serial').value.trim(),
    expressCompany: document.getElementById('hw-express-company').value.trim(),
    expressNo: document.getElementById('hw-express-no').value.trim(),
    phoneOs: document.getElementById('hw-phone-os').value,
    phoneBrand: document.getElementById('hw-phone-brand').value,
    phoneModel: document.getElementById('hw-phone-model').value.trim(),
    portType: document.getElementById('hw-port-type').value,
    btName: subtype === '蓝牙' ? document.getElementById('hw-bt-name').value.trim() : '',
    btMac: subtype === '蓝牙' ? document.getElementById('hw-bt-mac').value.trim() : '',
    btPin: subtype === '蓝牙' ? document.getElementById('hw-bt-pin').value.trim() : '',
    btNote: subtype === '蓝牙' ? document.getElementById('hw-bt-note').value.trim() : '',
    remark: document.getElementById('hw-remark').value.trim(),
    customFields: customFields
  };

  if (hwEditId) {
    const idx = list.findIndex(function (x) { return x.id === hwEditId; });
    if (idx >= 0) list[idx] = Object.assign({}, list[idx], data);
    toast('订单已更新');
  } else {
    list.push(Object.assign({ id: genId(), orderNo: genOrderNo('HW'), createdAt: nowISO() }, data));
    toast('硬件订单新增成功');
  }
  DB.set('hw_orders', list);
  closeModal('modal-hw-order');
  renderHwOrders();
}

function deleteHwOrder(id) {
  if (!confirm('确认删除该订单？')) return;
  DB.set('hw_orders', DB.get('hw_orders').filter(function (x) { return x.id !== id; }));
  toast('已删除');
  renderHwOrders();
}

// 苹果插口自动识别
function autoDetectPort() {
  const model = (document.getElementById('hw-phone-model').value || '').trim();
  const hint = document.getElementById('port-hint');
  const portSel = document.getElementById('hw-port-type');
  const osVal = document.getElementById('hw-phone-os').value;
  const isApple = osVal === '苹果' || model.toLowerCase().includes('iphone');
  if (!isApple) { hint.style.display = 'none'; return; }
  const m = model.match(/(\d+)/);
  if (m) {
    const gen = parseInt(m[1]);
    if (gen >= 15) {
      portSel.value = 'C口(Type-C)';
      hint.textContent = '💡 iPhone ' + gen + ' 代 → 自动识别为 C口(Type-C)（可手动修改）';
    } else {
      portSel.value = 'L口(Lightning)';
      hint.textContent = '💡 iPhone ' + gen + ' 代 → 自动识别为 L口(Lightning)（可手动修改）';
    }
    hint.style.display = 'block';
  } else { hint.style.display = 'none'; }
}

// 复制硬件订单
let copyHWOrderId = '';
const HW_COPY_FIELDS = [
  { key: 'productName', label: '产品名称' },
  { key: 'qty', label: '数量' },
  { key: 'amount', label: '金额' },
  { key: 'orderNo', label: '订单号' },
  { key: 'expressCompany', label: '快递公司' },
  { key: 'expressNo', label: '快递单号' },
  { key: 'phoneOs', label: '手机系统' },
  { key: 'phoneBrand', label: '手机品牌' },
  { key: 'phoneModel', label: '手机型号' },
  { key: 'portType', label: '插口类型' },
  { key: 'serialNo', label: '序列号' },
  { key: 'startDate', label: '发货日期' }
];

function openCopyHwModal(id) {
  copyHWOrderId = id;
  const o = DB.get('hw_orders').find(function (x) { return x.id === id; });
  if (!o) return;
  // 渲染字段选择
  document.getElementById('hw-copy-fields-check').innerHTML = HW_COPY_FIELDS.map(function (f) {
    return '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">' +
      '<input type="checkbox" value="' + f.key + '" checked onchange="updateHwCopyPreview(\'' + id + '\')"> ' + f.label + '</label>';
  }).join('');
  updateHwCopyPreview(id);
  openModal('modal-copy-hw');
}

function updateHwCopyPreview(id) {
  const o = DB.get('hw_orders').find(function (x) { return x.id === id; });
  if (!o) return;
  const tpl = DB.get('hw_tpl', { content: '', tips: '' });
  const checks = document.querySelectorAll('#hw-copy-fields-check input[type=checkbox]');
  const selectedKeys = [];
  checks.forEach(function (cb) { if (cb.checked) selectedKeys.push(cb.value); });
  const valMap = {
    productName: o.productName || '', qty: o.qty || '', amount: (o.amount || 0) + '元',
    orderNo: o.orderNo || '', expressCompany: o.expressCompany || '', expressNo: o.expressNo || '',
    phoneOs: o.phoneOs || '', phoneBrand: o.phoneBrand || '', phoneModel: o.phoneModel || '',
    portType: o.portType || '', serialNo: o.serialNo || '', startDate: o.startDate || ''
  };
  const labelMap = {};
  HW_COPY_FIELDS.forEach(function (f) { labelMap[f.key] = f.label; });

  let text = tpl.content || '';
  if (text) {
    text = text.replace(/{产品名称}/g, o.productName || '')
      .replace(/{数量}/g, o.qty || '')
      .replace(/{金额}/g, o.amount || '')
      .replace(/{订单号}/g, o.orderNo || '')
      .replace(/{快递公司}/g, o.expressCompany || '')
      .replace(/{快递单号}/g, o.expressNo || '')
      .replace(/{手机型号}/g, o.phoneModel || '')
      .replace(/{插口类型}/g, o.portType || '')
      .replace(/{序列号}/g, o.serialNo || '')
      .replace(/{手机系统}/g, o.phoneOs || '')
      .replace(/{提示语}/g, tpl.tips || '');
  } else {
    // 无模板时按选中字段生成
    text = '📦 硬件订单信息\n━━━━━━━━━━━━━━\n';
    selectedKeys.forEach(function (k) { if (valMap[k]) text += labelMap[k] + '：' + valMap[k] + '\n'; });
    text += '━━━━━━━━━━━━━━\n' + (tpl.tips ? '💡 ' + tpl.tips : '');
  }
  document.getElementById('hw-copy-preview').textContent = text;
  document.getElementById('modal-copy-hw').dataset.copyText = text;
}

function doCopyHwOrder() {
  const text = document.getElementById('modal-copy-hw').dataset.copyText || '';
  copyText(text, '订单信息');
  closeModal('modal-copy-hw');
}
