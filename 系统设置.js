/**
 * 系统设置.js - 销售客户管理系统 v3.0.0
 * 职责：系统设置、模板配置、数据导入导出
 */

function renderSettings() {
  const el = document.getElementById('page-settings');
  if (!el) return;
  const db = window.APP.db;
  const s = db.settings || {};
  const currentTheme = s.theme || 'dark';

  el.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">系统设置</h2>
    </div>

    <!-- 主题设置 -->
    <div class="section-card">
      <div class="section-card-header"><span>🎨 主题设置</span></div>
      <div style="padding:16px">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
          <button class="btn${currentTheme==='dark'?' btn-primary':''}" onclick="saveTheme('dark')" style="min-width:110px;${currentTheme==='dark'?'background:var(--accent);border-color:var(--accent);':''}">
            🌙 深色模式
          </button>
          <button class="btn${currentTheme==='light'?' btn-primary':''}" onclick="saveTheme('light')" style="min-width:110px;${currentTheme==='light'?'background:var(--accent);border-color:var(--accent);':''}">
            ☀️ 浅色模式
          </button>
          <button class="btn${currentTheme==='system'?' btn-primary':''}" onclick="saveTheme('system')" style="min-width:110px;${currentTheme==='system'?'background:var(--accent);border-color:var(--accent);':''}">
            🖥️ 跟随系统
          </button>
        </div>
        <div class="form-hint" style="margin-top:8px">
          跟随系统时，会自动匹配您设备的深色/浅色显示方案。
        </div>
      </div>
    </div>

    <!-- 基础设置 -->
    <div class="section-card">
      <div class="section-card-header"><span>⚙️ 基础设置</span></div>
      <div class="form-grid" style="padding:16px">
        <div class="form-group form-full">
          <label class="form-label">网站名称</label>
          <div style="display:flex;gap:8px">
            <input type="text" class="form-input" id="s-siteName" value="${s.siteName||''}" placeholder="留空则使用默认名称" style="flex:1">
            <button class="btn-primary" onclick="saveSiteName()">保存</button>
          </div>
          <div class="form-hint">保存后同步更新浏览器标签页标题和侧边栏标题</div>
        </div>
        <div class="form-group form-full">
          <label class="form-label">网站LOGO</label>
          <div style="display:flex;align-items:center;gap:12px;">
            <div id="logo-preview" style="${s.siteLogo ? '' : 'display:none'}">
              <img src="${s.siteLogo||''}" style="height:48px;border-radius:8px;border:1px solid #2d3555">
            </div>
            <input type="file" id="s-logoFile" accept="image/*" onchange="handleLogoUpload(this)" style="display:none">
            <button class="btn-secondary" onclick="document.getElementById('s-logoFile').click()">📷 上传LOGO</button>
            ${s.siteLogo ? `<button class="btn-danger" onclick="deleteLogo()">删除LOGO</button>` : ''}
          </div>
        </div>
      </div>
    </div>

    <!-- 客户来源管理 -->
    <div class="section-card">
      <div class="section-card-header"><span>🏷️ 客户来源管理</span></div>
      <div style="padding:16px">
        <div id="source-list" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
          ${(s.customerSources||[]).map((src,i) => `
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:20px;padding:4px 12px;display:flex;align-items:center;gap:6px;">
              <span style="color:var(--text-secondary);font-size:13px">${src}</span>
              <button onclick="deleteCustomerSource(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;line-height:1;">×</button>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;gap:8px">
          <input type="text" class="form-input" id="s-newSource" placeholder="新增来源..." style="flex:1" onkeydown="if(event.key==='Enter')addCustomerSource()">
          <button class="btn-primary" onclick="addCustomerSource()">+ 添加</button>
        </div>
      </div>
    </div>

    <!-- 快递API配置 -->
    <div class="section-card">
      <div class="section-card-header"><span>🚚 快递查询API配置</span></div>
      <div style="padding:16px">
        <div class="form-group">
          <label class="form-label">快递100 Customer ID</label>
          <div style="display:flex;gap:8px">
            <input type="text" class="form-input" id="s-expressCustomer" value="${s.expressCustomer||''}" placeholder="在开放平台个人中心获取" style="flex:1">
          </div>
          <div class="form-hint">快递100开放平台注册后，在「个人中心 → 我的KEY」中获取Customer ID</div>
        </div>
        <div class="form-group">
          <label class="form-label">快递100 API密钥（SecretKey）</label>
          <div style="display:flex;gap:8px">
            <input type="text" class="form-input" id="s-expressKey" value="${s.expressKey||''}" placeholder="在开放平台个人中心获取" style="flex:1">
            <button class="btn-primary" onclick="saveExpressKey()">保存</button>
          </div>
          <div class="form-hint">请妥善保存密钥，不要泄露给他人。配置后可在硬件订单详情中查询物流轨迹。</div>
        </div>
        <div id="express-config-status" style="margin-top:8px"></div>
      </div>
    </div>

    <!-- 软件订单复制模板 -->
    <div class="section-card">
      <div class="section-card-header"><span>📋 软件订单复制模板</span></div>
      <div style="padding:16px">
        <div class="form-group">
          <label class="form-label">模板内容</label>
          <textarea class="form-textarea" id="s-swTemplate" style="min-height:120px" oninput="previewTemplate('software')">${s.softwareCopyTemplate||''}</textarea>
          <div class="form-hint">可用变量：{产品名称} {订单号} {卡密} {购买日期} {有效期} {客户名称} {数量} {金额} {手机品牌} {手机型号} {序列号}</div>
        </div>
        <div class="form-group">
          <label class="form-label">预览效果</label>
          <div id="sw-template-preview" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;padding:12px;color:var(--text-secondary);font-size:13px;white-space:pre-wrap;min-height:60px;"></div>
        </div>
        <button class="btn-primary" onclick="saveTemplate('software')">保存软件模板</button>
        <button class="btn-secondary" style="margin-left:8px" onclick="resetTemplate('software')">恢复默认</button>
      </div>
    </div>

    <!-- 硬件订单复制模板 -->
    <div class="section-card">
      <div class="section-card-header"><span>📦 硬件订单复制模板</span></div>
      <div style="padding:16px">
        <div class="form-group">
          <label class="form-label">模板内容</label>
          <textarea class="form-textarea" id="s-hwTemplate" style="min-height:120px" oninput="previewTemplate('hardware')">${s.hardwareCopyTemplate||''}</textarea>
          <div class="form-hint">可用变量：{产品名称} {订单号} {收件人} {收件人手机} {收货地址} {快递公司} {物流单号} {数量} {金额} {手机品牌} {手机型号} {插口类型} {匹配软件}</div>
        </div>
        <div class="form-group">
          <label class="form-label">预览效果</label>
          <div id="hw-template-preview" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;padding:12px;color:var(--text-secondary);font-size:13px;white-space:pre-wrap;min-height:60px;"></div>
        </div>
        <button class="btn-primary" onclick="saveTemplate('hardware')">保存硬件模板</button>
        <button class="btn-secondary" style="margin-left:8px" onclick="resetTemplate('hardware')">恢复默认</button>
      </div>
    </div>

    <!-- 数据清理 -->
    <div class="section-card">
      <div class="section-card-header"><span>🗑️ 数据清理</span></div>
      <div style="padding:16px">
        <div class="form-hint" style="margin-bottom:12px">勾选要清除的数据类型，商品管理和系统设置始终保留不会被清除。</div>
        <div id="clear-data-list" style="display:flex;flex-direction:column;gap:10px;"></div>
        <div style="margin-top:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <button class="btn btn-outline" onclick="toggleAllClearBoxes(true)">全部勾选</button>
          <button class="btn btn-outline" onclick="toggleAllClearBoxes(false)">全部取消</button>
          <button class="btn btn-danger" onclick="clearSelectedData()" id="btn-clear-selected" disabled>🗑️ 清除选中数据</button>
        </div>
      </div>
    </div>

    <!-- 数据管理 -->
    <div class="section-card">
      <div class="section-card-header"><span>💾 数据管理</span></div>
      <div style="padding:16px;display:flex;gap:12px;flex-wrap:wrap;">
        <div>
          <button class="btn-primary" onclick="exportData()">📤 导出数据</button>
          <div class="form-hint" style="margin-top:4px">导出所有数据为JSON备份文件</div>
        </div>
        <div>
          <input type="file" id="import-file" accept=".json" onchange="importData(this)" style="display:none">
          <button class="btn-secondary" onclick="document.getElementById('import-file').click()">📥 导入数据</button>
          <div class="form-hint" style="margin-top:4px">从JSON备份文件恢复数据（将覆盖现有）</div>
        </div>
      </div>
    </div>

    <!-- 数据库说明 -->
    <div class="section-card">
      <div class="section-card-header"><span>ℹ️ 数据存储说明</span></div>
      <div style="padding:16px;color:var(--text-secondary);font-size:13px;line-height:1.8">
        <p>🔒 当前数据存储方式：<strong style="color:var(--link-color)">浏览器本地存储（LocalStorage）</strong></p>
        <p>⚠️ 注意：清除浏览器缓存或更换浏览器会导致数据丢失，请定期使用"导出数据"功能备份。</p>
        <p>📁 数据格式：JSON，包含客户、订单、商品、卡密、购卡记录、设置六个数据表</p>
        <p>💡 建议：重要操作前先导出备份，确保数据安全。</p>
      </div>
    </div>
  `;

  // 初始化模板预览 + 清理列表
  var _self = this;
  setTimeout(function() {
    previewTemplate('software');
    previewTemplate('hardware');
    var el = document.getElementById('clear-data-list');
    if (el) initClearDataList();
  }, 50);
}

// 保存网站名称
function saveSiteName() {
  const db = window.APP.db;
  const name = document.getElementById('s-siteName')?.value?.trim() || '销售客户管理系统';
  db.settings.siteName = name;
  saveDB();
  document.title = name;
  const titleEl = document.getElementById('site-title');
  if (titleEl) titleEl.textContent = name;
  showToast('网站名称已保存');
}

// LOGO上传
function handleLogoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const db = window.APP.db;
    db.settings.siteLogo = e.target.result;
    saveDB();
    const logoEl = document.getElementById('site-logo');
    if (logoEl) { logoEl.src = e.target.result; logoEl.style.display = 'block'; }
    showToast('LOGO已上传');
    renderSettings();
  };
  reader.readAsDataURL(file);
}

function deleteLogo() {
  const db = window.APP.db;
  db.settings.siteLogo = '';
  saveDB();
  const logoEl = document.getElementById('site-logo');
  if (logoEl) logoEl.style.display = 'none';
  showToast('LOGO已删除');
  renderSettings();
}

// 客户来源管理
function addCustomerSource() {
  const input = document.getElementById('s-newSource');
  const val = input?.value?.trim();
  if (!val) return;
  const db = window.APP.db;
  if (!db.settings.customerSources) db.settings.customerSources = [];
  if (db.settings.customerSources.includes(val)) { showToast('该来源已存在', 'warning'); return; }
  db.settings.customerSources.push(val);
  saveDB();
  if (input) input.value = '';
  showToast('来源已添加');
  renderSettings();
}

function deleteCustomerSource(idx) {
  const db = window.APP.db;
  db.settings.customerSources.splice(idx, 1);
  saveDB();
  renderSettings();
}

// 保存快递API（同时保存到本地数据库和服务端配置文件）
async function saveExpressKey() {
  const db = window.APP.db;
  const customer = document.getElementById('s-expressCustomer')?.value?.trim() || '';
  const key = document.getElementById('s-expressKey')?.value?.trim() || '';

  // 保存到本地数据库（前端使用）
  db.settings.expressCustomer = customer;
  db.settings.expressKey = key;
  saveDB();

  // 同步到服务端配置文件（代理API调用时使用）
  try {
    const resp = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expressCustomer: customer, expressKey: key })
    });
    const result = await resp.json();
    if (result.ok) {
      showToast('快递API配置已保存');
      updateExpressStatus(customer, key);
    } else {
      showToast('保存失败：' + result.message, 'error');
    }
  } catch(e) {
    showToast('保存失败：' + e.message, 'error');
  }
}

// 更新配置状态显示
function updateExpressStatus(customer, key) {
  const statusEl = document.getElementById('express-config-status');
  if (!statusEl) return;
  if (customer && key) {
    statusEl.innerHTML = '<span style="color:#4ade80;font-size:13px">✓ 已配置 Customer ID：' + customer + '</span>';
  } else {
    statusEl.innerHTML = '<span style="color:#f59e0b;font-size:13px">⚠ 未配置或配置不完整</span>';
  }
}

// 页面加载完成后检查配置状态
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const db = window.APP.db;
    if (db && db.settings) {
      updateExpressStatus(db.settings.expressCustomer || '', db.settings.expressKey || '');
    }
  }, 100);
});

// 保存复制模板
function saveTemplate(type) {
  const db = window.APP.db;
  if (type === 'software') {
    db.settings.softwareCopyTemplate = document.getElementById('s-swTemplate')?.value || '';
    showToast('软件订单模板已保存');
  } else {
    db.settings.hardwareCopyTemplate = document.getElementById('s-hwTemplate')?.value || '';
    showToast('硬件订单模板已保存');
  }
  saveDB();
}

// 重置模板
function resetTemplate(type) {
  const defaultDB = getEmptyDB();
  if (type === 'software') {
    const el = document.getElementById('s-swTemplate');
    if (el) { el.value = defaultDB.settings.softwareCopyTemplate; previewTemplate('software'); }
  } else {
    const el = document.getElementById('s-hwTemplate');
    if (el) { el.value = defaultDB.settings.hardwareCopyTemplate; previewTemplate('hardware'); }
  }
}

// 模板预览
function previewTemplate(type) {
  const demoVars = {
    software: {
      '产品名称': '路通年卡', '订单号': '软件-20260430-0001', '卡密': 'XXXX-YYYY-ZZZZ-1234',
      '购买日期': todayStr(), '有效期': calcExpireDate(todayStr(), 'yearly'),
      '客户名称': '张三', '数量': '1', '金额': '268.00',
      '手机品牌': '苹果(Apple)', '手机型号': 'iPhone 15 Pro', '序列号': 'SN123456789'
    },
    hardware: {
      '产品名称': 'iphone15以上C口', '订单号': '硬件-20260430-0001',
      '收件人': '李四', '收件人手机': '13812345678', '收货地址': '广东省深圳市南山区XX路XX号',
      '快递公司': '顺丰速运', '物流单号': 'SF1234567890',
      '数量': '1', '金额': '288.00', '手机品牌': '苹果(Apple)',
      '手机型号': 'iPhone 15', '插口类型': 'C', '匹配软件': '路通年卡'
    }
  };

  const templateEl = document.getElementById(type === 'software' ? 's-swTemplate' : 's-hwTemplate');
  const previewEl = document.getElementById(type === 'software' ? 'sw-template-preview' : 'hw-template-preview');
  if (!templateEl || !previewEl) return;

  const text = renderTemplate(templateEl.value, demoVars[type]);
  previewEl.textContent = text;
}

// 数据导出
function exportData() {
  const db = window.APP.db;
  const json = JSON.stringify(db, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `销售备份-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('数据已导出');
}

// 数据导入
function importData(input) {
  const file = input.files[0];
  if (!file) return;
  confirmDialog('⚠️ 导入将覆盖现有所有数据，确定继续吗？<br><small style="color:#94a3b8">建议先导出备份当前数据</small>', () => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.customers && !data.orders) { showToast('文件格式不正确', 'error'); return; }
        window.APP.db = data;
        saveDB();
        showToast('数据导入成功，即将刷新页面');
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        showToast('文件解析失败，请检查文件格式', 'error');
      }
    };
    reader.readAsText(file, 'utf-8');
  }, '确认导入数据');
  input.value = '';
}

// 清空全部数据
function clearAllData() {
  if (!confirm('⚠️ 此操作将清空所有客户、订单、商品、卡密、购卡记录数据！\n此操作不可恢复！\n确定继续吗？')) return;
  if (!confirm('❌ 再次确认：所有业务数据将被清空（商品管理和设置保留）')) return;
  const db = window.APP.db;
  const settings = db.settings;
  const productDisplayData = db.productDisplayData;
  window.APP.db = getEmptyDB();
  window.APP.db.settings = settings;
  window.APP.db.productDisplayData = productDisplayData;
  saveDB();
  alert('✅ 数据已全部清空，刷新页面后生效');
  location.reload();
}

// 数据清理 - 获取真实条数（直接读 localStorage，兼容系统实际存储结构）
function getClearCount(key) {
  try {
    var raw = localStorage.getItem('销售管理数据库');
    if (!raw) return 0;
    var db = JSON.parse(raw);
    if (key === 'sw_orders') return db.orders ? db.orders.filter(function(o){ return o.type==='software'; }).length : 0;
    if (key === 'hw_orders') return db.orders ? db.orders.filter(function(o){ return o.type==='hardware'; }).length : 0;
    var v = db[key];
    if (Array.isArray(v)) return v.length;
    if (v && typeof v === 'object') return Object.keys(v).length;
    return 0;
  } catch(e) { return 0; }
}

// 初始化清理列表
function initClearDataList() {
  var items = [
    { key: 'customers',    label: '客户管理',     count: getClearCount('customers'),    desc: '所有客户的联系方式、来源等信息' },
    { key: 'sw_orders',    label: '软件订单',     count: getClearCount('sw_orders'),    desc: '所有软件订单记录（卡密/金额/到期日）' },
    { key: 'hw_orders',    label: '硬件订单',     count: getClearCount('hw_orders'),    desc: '所有硬件订单记录（快递/手机信息）' },
    { key: 'cards',        label: '卡密库',        count: getClearCount('cards'),        desc: '所有预生成卡密及其使用状态' },
    { key: 'cardRecords',  label: '购卡记录',     count: getClearCount('cardRecords'),  desc: '所有购卡/充值记录' },
    { key: 'products',     label: '商品管理',     count: getClearCount('products'),     desc: '所有商品（名称/价格/状态），谨慎操作' },
    { key: 'sw_template',  label: '软件订单模板',  count: getClearCount('sw_template'),  desc: '软件订单复制消息模板' },
    { key: 'hw_template',  label: '硬件订单模板',  count: getClearCount('hw_template'),  desc: '硬件订单复制消息模板' },
  ];
  var container = document.getElementById('clear-data-list');
  if (!container) return;
  container.innerHTML = items.map(function(item) {
    var disabledAttr = item.key === 'products' ? '' : '';
    return '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 12px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);">' +
      '<input type="checkbox" class="clear-box" value="' + item.key + '" onchange="updateClearBtn()" style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent)">' +
      '<div style="flex:1">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<span style="font-weight:500">' + item.label + '</span>' +
          '<span class="badge badge-blue" style="font-size:11px">' + item.count + ' 条</span>' +
        '</div>' +
        '<div style="font-size:12px;color:var(--text-secondary);margin-top:2px">' + item.desc + '</div>' +
      '</div>' +
    '</label>';
  }).join('');
}

// 全选/取消
function toggleAllClearBoxes(checked) {
  var boxes = document.querySelectorAll('.clear-box');
  for (var i = 0; i < boxes.length; i++) { boxes[i].checked = checked; }
  updateClearBtn();
}

// 更新清除按钮
function updateClearBtn() {
  var boxes = document.querySelectorAll('.clear-box:checked');
  var btn = document.getElementById('btn-clear-selected');
  var n = boxes.length;
  if (btn) {
    btn.disabled = n === 0;
    btn.textContent = n === 0 ? '清除选中数据' : '清除选中数据（已选 ' + n + ' 项，共 ' + boxes.length + ' 项数据）';
  }
}

// 执行清除（直接操作 localStorage['销售管理数据库']，与系统实际存储完全一致）
function clearSelectedData() {
  var boxes = document.querySelectorAll('.clear-box:checked');
  if (!boxes.length) { alert('请先勾选要清除的数据项'); return; }
  var keys = [];
  for (var i = 0; i < boxes.length; i++) { keys.push(boxes[i].value); }
  var labelMap = { customers:'客户管理', sw_orders:'软件订单', hw_orders:'硬件订单', cards:'卡密库', cardRecords:'购卡记录', products:'商品管理', sw_template:'软件订单模板', hw_template:'硬件订单模板' };
  var labels = keys.map(function(k){ return labelMap[k] || k; });

  if (!confirm('\u26a0\ufe0f 确定清除以下数据？（此操作不可恢复）\n\n' + labels.join('、') + '\n\n点击确定继续。')) return;
  if (!confirm('\u274c 再次确认：' + labels.join('、') + ' 将被清空！')) return;

  try {
    var raw = localStorage.getItem('销售管理数据库');
    if (!raw) { alert('数据存储异常，无法清除'); return; }
    var db = JSON.parse(raw);

    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      if (key === 'sw_orders') {
        db.orders = (db.orders || []).filter(function(o){ return o.type !== 'software'; });
      } else if (key === 'hw_orders') {
        db.orders = (db.orders || []).filter(function(o){ return o.type !== 'hardware'; });
      } else if (key === 'sw_template') {
        db.settings = db.settings || {};
        db.settings.softwareCopyTemplate = '';
      } else if (key === 'hw_template') {
        db.settings = db.settings || {};
        db.settings.hardwareCopyTemplate = '';
      } else if (Array.isArray(db[key])) {
        db[key] = [];
      } else if (typeof db[key] === 'object' && db[key] !== null) {
        db[key] = {};
      }
    }

    // 直接写入 localStorage
    localStorage.setItem('销售管理数据库', JSON.stringify(db));
    // 同时更新内存中的 window.APP.db（保持一致性）
    if (window.APP && window.APP.db) window.APP.db = db;

    alert('\u2705 已清除 ' + labels.length + ' 项数据，刷新页面后生效');
    initClearDataList();
  } catch(e) {
    alert('清除失败：' + e.message);
  }
}

// 每次 renderSettings 后自动初始化清理列表
var _origRenderSettings = renderSettings;
renderSettings = function() {
  _origRenderSettings.apply(this, arguments);
  var container = document.getElementById('clear-data-list');
  if (container) setTimeout(initClearDataList, 50);
};
