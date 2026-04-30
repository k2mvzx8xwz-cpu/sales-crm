
// ============================================================
// 商品管理
// ============================================================
function renderProducts() {
  const list = DB.get('products');
  const tbody = document.getElementById('prod-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="icon">📦</div><div>暂无商品</div></div></td></tr>';
    return;
  }
  tbody.innerHTML = list.map(function (p, i) {
    return '<tr>' +
      '<td>' + (i + 1) + '</td>' +
      '<td>' + (p.name || '') + '</td>' +
      '<td><span class="badge ' + (p.type === '软件' ? 'badge-blue' : 'badge-purple') + '">' + (p.type || '') + '</span></td>' +
      '<td>' + (p.subtype || '-') + '</td>' +
      '<td><span class="badge ' + (p.status === '启用' ? 'badge-green' : 'badge-gray') + '">' + (p.status || '') + '</span></td>' +
      '<td>' + fmtDate(p.createdAt) + '</td>' +
      '<td><div class="action-row">' +
      '<button class="btn btn-outline btn-xs" onclick="openProductModal(\'' + p.id + '\')">编辑</button>' +
      '<button class="btn btn-danger btn-xs" onclick="deleteProduct(\'' + p.id + '\')">删除</button>' +
      '</div></td></tr>';
  }).join('');
}

function openProductModal(id) {
  const p = id ? DB.get('products').find(function (x) { return x.id === id; }) : null;
  document.getElementById('modal-product-title').textContent = p ? '编辑商品' : '新增商品';
  document.getElementById('prod-name').value = p ? (p.name || '') : '';
  document.getElementById('prod-type').value = p ? (p.type || '') : '';
  onProdTypeChange();
  if (p) document.getElementById('prod-subtype').value = p.subtype || '';
  document.getElementById('prod-status').value = p ? (p.status || '启用') : '启用';
  document.getElementById('modal-product').dataset.editId = id || '';
  openModal('modal-product');
}

function onProdTypeChange() {
  const type = document.getElementById('prod-type').value;
  const sub = document.getElementById('prod-subtype');
  if (type === '软件') {
    sub.innerHTML = '<option value="">请选择</option><option>月卡</option><option>季度卡</option><option>年卡</option><option>永久卡</option>';
  } else if (type === '硬件') {
    sub.innerHTML = '<option value="">请选择</option><option>蓝牙</option><option>定位</option>';
  } else {
    sub.innerHTML = '<option value="">请先选择商品类型</option>';
  }
}

function saveProduct() {
  const name = document.getElementById('prod-name').value.trim();
  const type = document.getElementById('prod-type').value;
  const subtype = document.getElementById('prod-subtype').value;
  if (!name) { toast('请填写商品名称', 'error'); return; }
  if (!type) { toast('请选择商品类型', 'error'); return; }
  const editId = document.getElementById('modal-product').dataset.editId;
  const list = DB.get('products');
  const data = { name: name, type: type, subtype: subtype, status: document.getElementById('prod-status').value };
  if (editId) {
    const idx = list.findIndex(function (x) { return x.id === editId; });
    if (idx >= 0) list[idx] = Object.assign({}, list[idx], data);
  } else {
    list.push(Object.assign({ id: genId(), createdAt: nowISO() }, data));
  }
  DB.set('products', list);
  closeModal('modal-product');
  toast(editId ? '商品已更新' : '商品新增成功');
  renderProducts();
}

function deleteProduct(id) {
  if (!confirm('确认删除该商品？')) return;
  DB.set('products', DB.get('products').filter(function (x) { return x.id !== id; }));
  toast('已删除');
  renderProducts();
}

function fillProductSelect(selectId, typeFilter) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const prods = DB.get('products').filter(function (p) { return (!typeFilter || p.type === typeFilter) && p.status === '启用'; });
  const cur = sel.value;
  sel.innerHTML = '<option value="">请选择商品</option>' + prods.map(function (p) {
    return '<option value="' + p.id + '" ' + (p.id === cur ? 'selected' : '') + '>' + p.name + '</option>';
  }).join('');
}

// ============================================================
// 卡密管理
// ============================================================
let keyPage = 1;

function renderKeycodes() {
  const all = DB.get('keycodes');
  const q = (document.getElementById('key-search').value || '').toLowerCase();
  const statusF = document.getElementById('key-status-filter').value || '';
  const typeF = document.getElementById('key-type-filter').value || '';

  let list = all.filter(function (k) {
    const match = !q || (k.content || '').toLowerCase().includes(q) || (k.productName || '').toLowerCase().includes(q);
    return match && (!statusF || k.status === statusF) && (!typeF || k.keyType === typeF);
  }).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

  renderPagination('key-page', list.length, keyPage, 'goKeyPage');
  const pageList = list.slice((keyPage - 1) * PAGE_SIZE, keyPage * PAGE_SIZE);
  const tbody = document.getElementById('key-tbody');

  if (!pageList.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="icon">🔑</div><div>暂无卡密</div></div></td></tr>';
    return;
  }
  tbody.innerHTML = pageList.map(function (k, i) {
    const keyEsc = (k.content || '').replace(/'/g, "\\'").replace(/\\/g, '\\\\');
    return '<tr>' +
      '<td>' + ((keyPage - 1) * PAGE_SIZE + i + 1) + '</td>' +
      '<td><span class="key-tag">' + escHtml(k.content || '') + '</span> <button class="copy-btn" onclick="copyText(\'' + keyEsc + '\',\'卡密\')">复制</button></td>' +
      '<td>' + (k.productName || '-') + '</td>' +
      '<td><span class="badge badge-blue">' + (k.keyType || '-') + '</span></td>' +
      '<td><span class="badge ' + (k.status === '已使用' ? 'badge-red' : 'badge-green') + '">' + (k.status || '未使用') + '</span></td>' +
      '<td style="font-size:11px;color:var(--text2)">' + (k.orderId ? k.orderId.substr(0, 8) + '...' : '-') + '</td>' +
      '<td>' + fmtDate(k.createdAt) + '</td>' +
      '<td><div class="action-row">' +
      (k.status !== '已使用' ? '<button class="btn btn-danger btn-xs" onclick="deleteKeycode(\'' + k.id + '\')">删除</button>' : '') +
      '<button class="btn btn-outline btn-xs" onclick="resetKeycode(\'' + k.id + '\')" title="重置为未使用">重置</button>' +
      '</div></td></tr>';
  }).join('');
}
function goKeyPage(p) { keyPage = p; renderKeycodes(); }

function openKeycodeModal() {
  document.getElementById('key-content').value = '';
  document.getElementById('key-remark').value = '';
  document.getElementById('key-type-sel').value = '';
  // 填充商品选项
  const sel = document.getElementById('key-product');
  const prods = DB.get('products').filter(function (p) { return p.type === '软件' && p.status === '启用'; });
  sel.innerHTML = '<option value="">不关联</option>' + prods.map(function (p) {
    return '<option value="' + p.id + '">' + p.name + '</option>';
  }).join('');
  openModal('modal-keycode');
}

function saveKeycode() {
  const content = document.getElementById('key-content').value.trim();
  const keyType = document.getElementById('key-type-sel').value;
  if (!content) { toast('请输入卡密内容', 'error'); return; }
  if (!keyType) { toast('请选择卡密类型', 'error'); return; }
  const prodId = document.getElementById('key-product').value;
  const prodName = prodId ? (DB.get('products').find(function (p) { return p.id === prodId; }) || {}).name || '' : '';
  // 检查重复
  const exist = DB.get('keycodes').find(function (k) { return k.content === content; });
  if (exist) { toast('该卡密已存在', 'warning'); return; }
  const list = DB.get('keycodes');
  list.push({ id: genId(), content: content, keyType: keyType, productId: prodId, productName: prodName, status: '未使用', remark: document.getElementById('key-remark').value.trim(), createdAt: nowISO() });
  DB.set('keycodes', list);
  closeModal('modal-keycode');
  toast('卡密新增成功');
  renderKeycodes();
}

function deleteKeycode(id) {
  if (!confirm('确认删除该卡密？')) return;
  DB.set('keycodes', DB.get('keycodes').filter(function (x) { return x.id !== id; }));
  toast('已删除');
  renderKeycodes();
}

function resetKeycode(id) {
  const keys = DB.get('keycodes');
  const ki = keys.findIndex(function (k) { return k.id === id; });
  if (ki >= 0) { keys[ki].status = '未使用'; delete keys[ki].orderId; DB.set('keycodes', keys); toast('已重置为未使用'); renderKeycodes(); }
}

function openBatchImportKeyModal() {
  document.getElementById('batch-key-content').value = '';
  document.getElementById('batch-key-type').value = '';
  const sel = document.getElementById('batch-key-product');
  const prods = DB.get('products').filter(function (p) { return p.type === '软件'; });
  sel.innerHTML = '<option value="">不关联</option>' + prods.map(function (p) {
    return '<option value="' + p.id + '">' + p.name + '</option>';
  }).join('');
  openModal('modal-batch-import-key');
}

function saveBatchKeys() {
  const keyType = document.getElementById('batch-key-type').value;
  const raw = document.getElementById('batch-key-content').value;
  if (!keyType) { toast('请选择卡密类型', 'error'); return; }
  if (!raw.trim()) { toast('请输入卡密列表', 'error'); return; }
  const prodId = document.getElementById('batch-key-product').value;
  const prodName = prodId ? (DB.get('products').find(function (p) { return p.id === prodId; }) || {}).name || '' : '';
  const lines = raw.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  const list = DB.get('keycodes');
  const existSet = new Set(list.map(function (k) { return k.content; }));
  let added = 0, dup = 0;
  lines.forEach(function (line) {
    if (existSet.has(line)) { dup++; return; }
    list.push({ id: genId(), content: line, keyType: keyType, productId: prodId, productName: prodName, status: '未使用', remark: '', createdAt: nowISO() });
    existSet.add(line);
    added++;
  });
  DB.set('keycodes', list);
  closeModal('modal-batch-import-key');
  toast('导入完成：新增 ' + added + ' 条' + (dup ? '，跳过重复 ' + dup + ' 条' : ''));
  renderKeycodes();
}

// ============================================================
// 品牌管理
// ============================================================
function fillBrandSelect() {
  const sel = document.getElementById('hw-phone-brand');
  if (!sel) return;
  const brands = DB.get('brands', []);
  const cur = sel.value;
  sel.innerHTML = '<option value="">请选择</option>' + brands.map(function (b) {
    return '<option value="' + b + '" ' + (b === cur ? 'selected' : '') + '>' + b + '</option>';
  }).join('');
}

function renderBrandList() {
  const brands = DB.get('brands', []);
  document.getElementById('brand-list').innerHTML = brands.map(function (b) {
    return '<span class="tag">' + b + ' <button style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:12px;padding:0 2px" onclick="deleteBrand(\'' + b + '\')">×</button></span>';
  }).join('');
}

function addBrand() {
  const val = document.getElementById('new-brand').value.trim();
  if (!val) { toast('请输入品牌名称', 'error'); return; }
  const brands = DB.get('brands', []);
  if (brands.includes(val)) { toast('品牌已存在', 'warning'); return; }
  brands.push(val);
  DB.set('brands', brands);
  document.getElementById('new-brand').value = '';
  toast('品牌已添加');
  renderBrandList();
}

function deleteBrand(name) {
  const brands = DB.get('brands', []).filter(function (b) { return b !== name; });
  DB.set('brands', brands);
  toast('已删除');
  renderBrandList();
}

// ============================================================
// 自定义字段
// ============================================================
function renderCustomFieldsList() {
  const fields = DB.get('custom_fields', []);
  const container = document.getElementById('custom-fields-list');
  if (!fields.length) {
    container.innerHTML = '<div class="empty-state" style="padding:20px"><div>暂无自定义字段</div></div>';
    return;
  }
  container.innerHTML = fields.map(function (f) {
    const scopeMap = { both: '软件+硬件', sw: '仅软件', hw: '仅硬件' };
    return '<div class="field-item">' +
      '<span class="field-name">' + f.name + '</span>' +
      '<span class="field-type">' + f.type + '</span>' +
      '<span class="field-type">' + (scopeMap[f.scope] || f.scope) + '</span>' +
      '<button class="btn btn-danger btn-xs" onclick="deleteCustomField(\'' + f.id + '\')">删除</button>' +
      '</div>';
  }).join('');
}

function openAddFieldModal() {
  document.getElementById('field-name').value = '';
  document.getElementById('field-type').value = 'text';
  document.getElementById('field-options').value = '';
  document.getElementById('field-scope').value = 'both';
  document.getElementById('field-options-group').classList.add('hidden');
  document.getElementById('modal-add-field').dataset.editId = '';
  openModal('modal-add-field');
}

function onFieldTypeChange() {
  const type = document.getElementById('field-type').value;
  const group = document.getElementById('field-options-group');
  if (type === 'select') group.classList.remove('hidden');
  else group.classList.add('hidden');
}

function saveCustomField() {
  const name = document.getElementById('field-name').value.trim();
  if (!name) { toast('请填写字段名称', 'error'); return; }
  const fields = DB.get('custom_fields', []);
  const fieldType = document.getElementById('field-type').value;
  const options = fieldType === 'select' ? document.getElementById('field-options').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
  fields.push({ id: genId(), name: name, type: fieldType, options: options, scope: document.getElementById('field-scope').value });
  DB.set('custom_fields', fields);
  closeModal('modal-add-field');
  toast('字段已添加');
  renderCustomFieldsList();
}

function deleteCustomField(id) {
  if (!confirm('确认删除该自定义字段？')) return;
  DB.set('custom_fields', DB.get('custom_fields', []).filter(function (f) { return f.id !== id; }));
  toast('已删除');
  renderCustomFieldsList();
}

function renderCustomFields(scope, vals) {
  // scope: 'sw' or 'hw'
  vals = vals || {};
  const fields = DB.get('custom_fields', []).filter(function (f) { return f.scope === 'both' || f.scope === scope; });
  const grid = document.getElementById(scope + '-custom-fields-grid');
  const section = document.getElementById(scope + '-custom-fields-section');
  if (!fields.length) { if (section) section.classList.add('hidden'); return; }
  if (section) section.classList.remove('hidden');
  grid.innerHTML = fields.map(function (f) {
    const val = vals[f.id] || '';
    let input = '';
    if (f.type === 'select') {
      input = '<select id="cf-' + f.id + '"><option value="">请选择</option>' + f.options.map(function (o) { return '<option value="' + o + '" ' + (o === val ? 'selected' : '') + '>' + o + '</option>'; }).join('') + '</select>';
    } else if (f.type === 'textarea') {
      input = '<textarea id="cf-' + f.id + '" rows="2">' + escHtml(val) + '</textarea>';
    } else {
      input = '<input type="' + f.type + '" id="cf-' + f.id + '" value="' + escHtml(val) + '">';
    }
    return '<div class="form-group"><label>' + f.name + '</label>' + input + '</div>';
  }).join('');
}

function collectCustomFields(scope) {
  const fields = DB.get('custom_fields', []).filter(function (f) { return f.scope === 'both' || f.scope === scope; });
  const result = {};
  fields.forEach(function (f) {
    const el = document.getElementById('cf-' + f.id);
    if (el) result[f.id] = el.value;
  });
  return result;
}

// ============================================================
// 系统设置
// ============================================================
function renderSettings() {
  // 模板
  const swTpl = DB.get('sw_tpl', { content: '', tips: '' });
  const hwTpl = DB.get('hw_tpl', { content: '', tips: '' });
  document.getElementById('sw-tpl-tips').value = swTpl.tips || '';
  document.getElementById('sw-tpl-content').value = swTpl.content || '';
  document.getElementById('hw-tpl-tips').value = hwTpl.tips || '';
  document.getElementById('hw-tpl-content').value = hwTpl.content || '';
  updateTplPreview('sw');
  updateTplPreview('hw');
  // 绑定实时预览
  document.getElementById('sw-tpl-content').oninput = function () { updateTplPreview('sw'); };
  document.getElementById('sw-tpl-tips').oninput = function () { updateTplPreview('sw'); };
  document.getElementById('hw-tpl-content').oninput = function () { updateTplPreview('hw'); };
  document.getElementById('hw-tpl-tips').oninput = function () { updateTplPreview('hw'); };
  // 自定义字段
  renderCustomFieldsList();
  // 基本设置
  const settings = DB.get('settings', {});
  document.getElementById('sys-name').value = settings.sysName || '销售客户管理系统';
  document.getElementById('sys-express').value = settings.defaultExpress || '';
  // 品牌
  renderBrandList();
}

function updateTplPreview(type) {
  const content = document.getElementById(type + '-tpl-content').value || '';
  const tips = document.getElementById(type + '-tpl-tips').value || '';
  const preview = document.getElementById(type + '-tpl-preview');
  const sample = content
    .replace(/{产品名称}/g, '示例商品')
    .replace(/{卡密}/g, 'XXXX-XXXX-XXXX')
    .replace(/{购买数量}/g, '1')
    .replace(/{金额}/g, '99')
    .replace(/{购买日期}/g, todayStr())
    .replace(/{到期日期}/g, '2026-12-31')
    .replace(/{客户微信名}/g, '张三')
    .replace(/{客户手机}/g, '138****0000')
    .replace(/{数量}/g, '1')
    .replace(/{订单号}/g, 'HW260429DEMO')
    .replace(/{快递公司}/g, '顺丰')
    .replace(/{快递单号}/g, 'SF12345678')
    .replace(/{手机型号}/g, 'iPhone 15')
    .replace(/{插口类型}/g, 'C口(Type-C)')
    .replace(/{序列号}/g, 'SN0001')
    .replace(/{手机系统}/g, '苹果')
    .replace(/{提示语}/g, tips);
  preview.textContent = sample;
}

function saveTpl(type) {
  const tpl = {
    content: document.getElementById(type + '-tpl-content').value,
    tips: document.getElementById(type + '-tpl-tips').value
  };
  DB.set(type + '_tpl', tpl);
  toast('模板已保存');
}

function saveGeneralSettings() {
  DB.set('settings', {
    sysName: document.getElementById('sys-name').value.trim(),
    defaultExpress: document.getElementById('sys-express').value.trim()
  });
  toast('设置已保存');
}

// ============================================================
// 数据备份管理
// ============================================================
function exportData() {
  const data = {
    version: '2.0',
    exportTime: new Date().toISOString(),
    customers: DB.get('customers'),
    sw_orders: DB.get('sw_orders'),
    hw_orders: DB.get('hw_orders'),
    products: DB.get('products'),
    keycodes: DB.get('keycodes'),
    brands: DB.get('brands', []),
    sw_tpl: DB.get('sw_tpl', {}),
    hw_tpl: DB.get('hw_tpl', {}),
    settings: DB.get('settings', {}),
    custom_fields: DB.get('custom_fields', [])
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '销售管理系统备份_' + todayStr() + '.json';
  a.click();
  toast('数据已导出');
}

function importData(input) {
  const file = input.files[0];
  if (!file) return;
  if (!confirm('导入将覆盖当前所有数据，确认继续？')) { input.value = ''; return; }
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      const keys = ['customers', 'sw_orders', 'hw_orders', 'products', 'keycodes', 'brands', 'sw_tpl', 'hw_tpl', 'settings', 'custom_fields'];
      keys.forEach(function (k) { if (data[k] !== undefined) DB.set(k, data[k]); });
      localStorage.setItem('crm_inited', '1');
      toast('数据导入成功');
      renderDashboard();
    } catch (err) {
      toast('导入失败：文件格式错误', 'error');
    }
    input.value = '';
  };
  reader.readAsText(file, 'utf-8');
}

function clearAllData() {
  if (!confirm('确认清空所有数据？此操作不可恢复！')) return;
  if (!confirm('再次确认：真的要删除所有数据吗？')) return;
  const keys = ['customers', 'sw_orders', 'hw_orders', 'products', 'keycodes', 'brands', 'sw_tpl', 'hw_tpl', 'settings', 'custom_fields'];
  keys.forEach(function (k) { localStorage.removeItem('crm_' + k); });
  localStorage.removeItem('crm_inited');
  toast('数据已清空，刷新页面后重新初始化', 'warning');
  setTimeout(function () { location.reload(); }, 2000);
}

// ============================================================
// 快速新增入口
// ============================================================
function quickAdd() {
  // 弹出选择
  const type = prompt('请选择新增类型：\n1 = 新增客户\n2 = 新增软件订单\n3 = 新增硬件订单\n\n输入数字：');
  if (type === '1') openCustomerModal();
  else if (type === '2') openSwOrderModal();
  else if (type === '3') openHwOrderModal();
}

// ============================================================
// AI自检补全：独立设置页Tab绑定（与通用tab-nav解耦）
// ============================================================
function bindSettingsTabs() {
  const nav = document.getElementById('settings-tab-nav');
  if (!nav) return;
  nav.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      nav.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      ['tpl', 'fields', 'general'].forEach(function (t) {
        const tc = document.getElementById('tab-' + t);
        if (tc) tc.classList.add('hidden');
      });
      const target = document.getElementById('tab-' + btn.dataset.tab);
      if (target) target.classList.remove('hidden');
    });
  });
}

// AI自检补全：订单号展示时序列号过长截断处理
function truncate(str, len) {
  len = len || 20;
  if (!str) return '';
  return str.length > len ? str.substr(0, len) + '…' : str;
}

// AI自检补全：日期差计算（带容错）
function daysDiff(dateStr) {
  if (!dateStr) return null;
  try { return Math.ceil((new Date(dateStr) - new Date(todayStr())) / 86400000); }
  catch (e) { return null; }
}

// ============================================================
// 应用初始化
// ============================================================
function init() {
  initDefaultData();
  // 设置当前日期
  const now = new Date();
  const dateStr = now.getFullYear() + '年' + pad(now.getMonth() + 1) + '月' + pad(now.getDate()) + '日 ' +
    ['日','一','二','三','四','五','六'][now.getDay()];
  const el = document.getElementById('current-date');
  if (el) el.textContent = '📅 ' + dateStr;
  // 绑定设置页独立Tab
  bindSettingsTabs();
  // 渲染首页
  renderDashboard();
}

// DOM加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
