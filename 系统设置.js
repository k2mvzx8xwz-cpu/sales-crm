/**
 * 系统设置.js - 销售客户管理系统 v4.0.0
 * 职责：系统设置、模板配置、数据导入导出
 */

function renderSettings() {
  const el = document.getElementById('page-settings');
  if (!el) { console.error('[renderSettings] #page-settings 元素不存在'); return; }
  if (!window.APP || !window.APP.db) {
    el.innerHTML = '<div style="padding:40px;color:var(--text-muted);text-align:center;">数据未就绪，请刷新页面</div>';
    console.error('[renderSettings] window.APP.db 未初始化');
    return;
  }
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

    <!-- 云端数据同步 -->
    <div class="section-card">
      <div class="section-card-header"><span>☁️ 云端数据同步（PC与手机数据同步）</span><span id="sync-status" style="font-size:12px;font-weight:400;color:var(--text-muted);margin-left:8px"></span></div>
      <div style="padding:16px">
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:14px;">
          <div style="font-size:13px;color:var(--text-secondary);line-height:1.6;">
            <p style="margin-bottom:8px"><strong style="color:var(--text-primary)">开启云端同步后</strong>，您的客户、订单、卡密等数据将在所有设备间自动同步。</p>
            <p>PC端新增数据 → 手机立即可见<br>手机新增数据 → PC刷新即可见</p>
          </div>
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Firebase Realtime Database 配置</label>
          <textarea class="form-textarea" id="s-firebase-config" rows="4" placeholder="粘贴 Firebase 项目配置 JSON（格式见下方说明）" style="font-size:12px;resize:vertical;min-height:90px;">${s.firebaseConfig ? JSON.stringify(s.firebaseConfig, null, 2) : ''}</textarea>
          <div class="form-hint" style="margin-top:6px">
            Firebase 是免费的实时数据库服务，开启云同步前需要配置。配置步骤：
            <a href="https://console.firebase.google.com/" target="_blank" class="link" style="font-size:12px">1. 打开 Firebase Console → 新建项目 → Realtime Database → 创建数据库（选测试模式）→ 获取 Web 配置</a>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn-primary" onclick="saveFirebaseConfig()">💾 保存并启用云同步</button>
          <button class="btn-warning" onclick="manualSyncNow()">🔄 立即同步</button>
          <button class="btn-danger" onclick="clearFirebaseConfig()">🗑 清除配置</button>
        </div>
        <div style="margin-top:10px;">
          <button class="btn-danger" onclick="clearCloudData()" style="font-size:12px;padding:6px 12px;">⚠️ 清空云端数据</button>
          <span style="color:var(--text-muted);font-size:11px;margin-left:8px;">谨慎操作：清空后所有设备数据都将被删除</span>
        </div>
        <div id="firebase-test-result" style="margin-top:10px;font-size:13px;"></div>
      </div>
    </div>

    <!-- 数据导入导出（跨设备同步，无需注册账号）-->
    <div class="section-card">
      <div class="section-card-header"><span>💾 数据导入导出（跨设备手动同步）</span></div>
      <div style="padding:16px">
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:14px;font-size:13px;color:var(--text-secondary);line-height:1.6;">
          <strong style="color:var(--text-primary)">使用步骤：</strong><br>
          ① 在设备A点「<strong>导出数据</strong>」→ 复制生成的JSON内容<br>
          ② 在设备B打开系统 → 点「<strong>导入数据</strong>」→ 粘贴JSON → 确认导入<br>
          <strong style="color:var(--accent)">提示：</strong>导入会覆盖本机当前数据，建议导入前先导出备份。
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">JSON 数据（导入时粘贴至此）</label>
          <textarea class="form-textarea" id="s-import-data" rows="6" placeholder="从其他设备复制 JSON 数据，粘贴于此，然后点「导入数据」" style="font-size:12px;resize:vertical;min-height:120px;font-family:monospace;"></textarea>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn-primary" onclick="exportAllData()">📤 导出全部数据</button>
          <button class="btn-warning" onclick="importAllData()">📥 导入全部数据</button>
          <button class="btn-secondary" onclick="exportAllDataToFile()">📁 下载为文件</button>
        </div>
        <div id="import-result" style="margin-top:10px;font-size:13px;"></div>
      </div>
    </div>

    <!-- 配置备份与恢复 -->
    <div class="section-card">
      <div class="section-card-header"><span>🔐 配置备份与恢复（防止数据丢失）</span></div>
      <div style="padding:16px">
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:14px;font-size:13px;color:var(--text-secondary);line-height:1.6;">
          <strong style="color:var(--text-primary)">为什么需要备份配置？</strong><br>
          清除浏览器数据时，Firebase配置会丢失，导致无法连接云端恢复数据。<br>
          请定期备份配置，清除数据后可通过"恢复配置"快速重新连接云端。
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn-primary" onclick="backupConfig()">📦 备份配置</button>
          <button class="btn-warning" onclick="restoreConfig()">📂 恢复配置</button>
          <button class="btn-secondary" onclick="downloadConfigFile()">💾 下载配置文件</button>
        </div>
        <div id="config-backup-result" style="margin-top:10px;font-size:13px;"></div>
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
  setTimeout(function() {
    previewTemplate('software');
    previewTemplate('hardware');
    initClearDataList();
  }, 100);
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

// ==================== 配置备份与恢复 ====================
function backupConfig() {
  const db = window.APP.db;
  const config = db.settings && db.settings.firebaseConfig;
  if (!config || !config.apiKey) {
    showToast('请先配置Firebase', 'warning');
    return;
  }
  const json = JSON.stringify({ firebaseConfig: config }, null, 2);
  const importEl = document.getElementById('s-import-data');
  if (importEl) importEl.value = json;
  showToast('配置已写入导入框，请复制保存！', 'success', 3000);
}

function downloadConfigFile() {
  const db = window.APP.db;
  const config = db.settings && db.settings.firebaseConfig;
  if (!config || !config.apiKey) {
    showToast('请先配置Firebase', 'warning');
    return;
  }
  const json = JSON.stringify({ firebaseConfig: config }, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `firebase-config-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('配置文件已下载，请妥善保存！', 'success');
}

function restoreConfig() {
  const jsonStr = document.getElementById('s-import-data')?.value?.trim();
  if (!jsonStr) {
    // 尝试从文件输入恢复
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,.txt,application/json';
    fileInput.onchange = function() {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = JSON.parse(e.target.result);
          applyRestoredConfig(data);
        } catch(err) {
          showToast('文件解析失败', 'error');
        }
      };
      reader.readAsText(file, 'utf-8');
    };
    fileInput.click();
    return;
  }
  try {
    const data = JSON.parse(jsonStr);
    applyRestoredConfig(data);
  } catch(e) {
    showToast('JSON格式错误，请检查', 'error');
  }
}

function applyRestoredConfig(data) {
  const config = data.firebaseConfig;
  if (!config || !config.apiKey) {
    showToast('配置格式不正确，缺少apiKey', 'error');
    return;
  }
  confirmDialog('确定恢复Firebase配置吗？当前配置将被覆盖。', () => {
    if (!window.APP.db.settings) window.APP.db.settings = {};
    window.APP.db.settings.firebaseConfig = config;
    saveDB();
    window.APP_FIREBASE_CONFIG = config;
    const success = initFirebase();
    if (success) {
      showToast('配置已恢复，正在同步云端数据...', 'success');
      setTimeout(() => manualSyncNow(), 1000);
    } else {
      showToast('配置已保存，但Firebase初始化失败', 'warning');
      }
    });
  }, '恢复配置');
}

// ==================== 数据导入（修改版，支持配置恢复） ====================
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
async function clearAllData() {
  confirmDialog('⚠️ 此操作将清空所有客户、订单、卡密、购卡记录数据！\n此操作不可恢复！\n\n确定继续吗？', async function() {
    const db = window.APP.db;
    const settings = db.settings;
    const productDisplayData = db.productDisplayData;
    window.APP.db = getEmptyDB();
    window.APP.db.settings = settings;
    window.APP.db.productDisplayData = productDisplayData;
    saveDB_localOnly();
    // 立即推送到云端（不等防抖），避免刷新后云端数据又覆盖回来
    await saveToCloud(window.APP.db);
    showToast('✅ 数据已全部清空并同步到云端，即将刷新页面', 'success');
    setTimeout(function(){ location.reload(); }, 1500);
  }, '确认清空全部数据');
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
async function clearSelectedData() {
  var boxes = document.querySelectorAll('.clear-box:checked');
  if (!boxes.length) { showToast('请先勾选要清除的数据项', 'warning'); return; }
  var keys = [];
  for (var i = 0; i < boxes.length; i++) { keys.push(boxes[i].value); }
  var labelMap = { customers:'客户管理', sw_orders:'软件订单', hw_orders:'硬件订单', cards:'卡密库', cardRecords:'购卡记录', products:'商品管理', sw_template:'软件订单模板', hw_template:'硬件订单模板' };
  var labels = keys.map(function(k){ return labelMap[k] || k; });

  confirmDialog('⚠️ 确定清除以下数据？（此操作不可恢复）\n\n' + labels.join('、') + '\n\n点击确定继续。', async function() {
    try {
      var raw = localStorage.getItem('销售管理数据库');
      if (!raw) { showToast('数据存储异常，无法清除', 'error'); return; }
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

      // 写入 localStorage
      localStorage.setItem('销售管理数据库', JSON.stringify(db));
      // 更新内存中的 window.APP.db
      if (window.APP && window.APP.db) window.APP.db = db;
      // 立即推送到云端（不等防抖），避免刷新后云端数据又覆盖回来
      await saveToCloud(db);

      showToast('✅ 已清除 ' + labels.length + ' 项数据并同步到云端', 'success');
      initClearDataList();
    } catch(e) {
      showToast('清除失败：' + e.message, 'error');
    }
  }, '确认清除');
}

// ==================== Firebase REST API 云同步配置 ====================
async function saveFirebaseConfig() {
  var raw = document.getElementById('s-firebase-config')?.value?.trim();
  var resultEl = document.getElementById('firebase-test-result');
  if (!raw) { resultEl.innerHTML = '<span style="color:#ef4444">请先粘贴 Firebase 配置</span>'; return; }

  var config;
  try {
    // 优先当作纯 JSON 解析
    config = JSON.parse(raw);
  } catch (e) {
    // 如果纯 JSON 失败，尝试从完整 JS 代码中提取 firebaseConfig 对象
    var match = raw.match(/firebaseConfig\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (!match) {
      // 尝试提取 const firebaseConfig = {...} 格式
      match = raw.match(/const\s+firebaseConfig\s*=\s*(\{[\s\S]*?\})\s*;/);
    }
    if (!match) {
      // 尝试直接提取 {...} 第一个完整对象
      var braceStart = raw.indexOf('{');
      var braceEnd = raw.lastIndexOf('}');
      if (braceStart >= 0 && braceEnd > braceStart) {
        try {
          config = JSON.parse(raw.substring(braceStart, braceEnd + 1));
        } catch (e2) {
          resultEl.innerHTML = '<span style="color:#ef4444">无法识别配置格式，请粘贴 Firebase 给的完整代码或纯 JSON</span>';
          return;
        }
      } else {
        resultEl.innerHTML = '<span style="color:#ef4444">无法识别配置格式，请粘贴 Firebase 给的完整代码或纯 JSON</span>';
        return;
      }
    } else {
      try {
        // 把 JS 对象字面量转成 JSON（去掉末尾逗号等）
        var objStr = match[1].replace(/,(\s*[}\]])/g, '$1');
        config = JSON.parse(objStr);
      } catch (e2) {
        resultEl.innerHTML = '<span style="color:#ef4444">JSON 解析失败：' + e2.message + '</span>';
        return;
      }
    }
  }
  if (!config.apiKey || !config.databaseURL) {
    resultEl.innerHTML = '<span style="color:#ef4444">配置缺少 apiKey 或 databaseURL 字段</span>';
    return;
  }
  // 保存配置到本地数据
  var db = window.APP.db;
  db.settings.firebaseConfig = config;
  saveDB();
  resultEl.innerHTML = '<span style="color:#94a3b8">正在测试 Firebase 连接（8秒超时）…</span>';
  
  var success = initFirebase();
  if (!success) {
    resultEl.innerHTML = '<span style="color:#ef4444">❌ 缺少 databaseURL，请检查配置是否完整。</span>';
    return;
  }
  
  // 先测试连接（读取云端），而不是直接写入
  var cloudData;
  try {
    cloudData = await Promise.race([
      loadFromCloud(true),   // true = 失败立即抛异常
      new Promise((_, reject) => setTimeout(() => reject(new Error('连接超时（超过8秒），请检查网络或数据库URL是否正确')), 8000))
    ]);
    // 连接成功
    resultEl.innerHTML = '<span style="color:#10b981">✅ Firebase 连接成功！</span>';
  } catch (e) {
    resultEl.innerHTML = '<span style="color:#ef4444">❌ 连接失败：' + e.message + '<br><small>请检查：① 配置是否正确 ② 数据库规则是否允许读写 ③ 网络能否访问 Firebase</small></span>';
    showToast('Firebase 连接失败', 'error', 4000);
    var statusEl2 = document.getElementById('sync-status');
    if (statusEl2) statusEl2.textContent = '⚠️ 连接失败';
    return;
  }
  
  // 连接成功，询问用户如何处理云端数据
  if (cloudData) {
    // 云端有数据，询问是否覆盖本地
    confirmDialog('云端已有数据，是否用云端数据覆盖本地数据？<br><small style="color:#94a3b8">取消则保留本地数据，并将本地数据同步到云端</small>', () => {
      // 用云端数据覆盖本地
      window.APP.db = cloudData;
      saveDB_localOnly();
      showToast('已从云端恢复数据', 'success', 3000);
      renderDashboard();
      resultEl.innerHTML = '<span style="color:#10b981">✅ 已从云端恢复数据！</span>';
    }, '云端数据冲突');
    // 如果用户取消，则保留本地数据，继续下面的同步逻辑
  }
  
  // 启动轮询监听
  startCloudPolling();
  window.APP_CLOUD_LAST_HASH = JSON.stringify(window.APP.db);
  
  // 将当前数据同步到云端
  var syncOk = await flushCloudSync();
  if (syncOk) {
    resultEl.innerHTML = '<span style="color:#10b981">✅ 云同步已启用！数据已同步到云端。</span>';
    showToast('云端同步已启用，其他设备刷新即可见', 'success', 4000);
  } else {
    resultEl.innerHTML = '<span style="color:#f59e0b">⚠️ 配置成功，但写入云端失败。请确认 Firebase 数据库规则为「测试模式」。</span>';
  }
  var statusEl = document.getElementById('sync-status');
  if (statusEl) statusEl.textContent = '☁️ 已连接';
}

// 手动立即同步按钮 - 调用全局 syncNow
async function manualSyncNow() {
  // 直接调用全局的 syncNow 函数（已在核心工具.js中定义）
  if (typeof syncNow === 'function') {
    await syncNow();
  } else {
    showToast('同步功能加载中，请稍后重试', 'warning', 3000);
  }
}

function clearFirebaseConfig() {
  if (!confirm('确定清除 Firebase 配置？清除后云端同步将关闭，但本地数据不会丢失。')) return;
  var db = window.APP.db;
  db.settings.firebaseConfig = null;
  saveDB();
  window.APP_FIREBASE_CONFIG = null;
  window.APP_FIREBASE_INITIALIZED = false;
  var statusEl = document.getElementById('sync-status');
  if (statusEl) statusEl.textContent = '';
  renderSettings();
  showToast('Firebase 配置已清除');
}

// ==================== JSON 导入导出（跨设备手动同步）====================
function exportAllData() {
  var data = JSON.stringify(window.APP.db, null, 2);
  var textarea = document.getElementById('s-import-data');
  if (textarea) textarea.value = data;
  var resultEl = document.getElementById('import-result');
  resultEl.innerHTML = '<span style="color:#10b981">✅ 数据已导出到上方文本框，请复制全部内容（Ctrl+A → Ctrl+C）</span>';
  showToast('数据已导出，可复制到其他设备导入', 'success', 3000);
}

function exportAllDataToFile() {
  var data = JSON.stringify(window.APP.db, null, 2);
  var blob = new Blob([data], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  var now = new Date();
  var dateStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
  a.href = url;
  a.download = '销售CRM数据备份_' + dateStr + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  var resultEl = document.getElementById('import-result');
  resultEl.innerHTML = '<span style="color:#10b981">✅ 文件已下载（备份_' + dateStr + '.json）</span>';
  showToast('备份文件已下载', 'success', 2000);
}

function importAllData() {
  var textarea = document.getElementById('s-import-data');
  var resultEl = document.getElementById('import-result');
  var raw = textarea ? textarea.value.trim() : '';
  if (!raw) {
    resultEl.innerHTML = '<span style="color:#ef4444">请先在上方粘贴要导入的 JSON 数据</span>';
    return;
  }
  var importedData;
  try {
    importedData = JSON.parse(raw);
  } catch(e) {
    resultEl.innerHTML = '<span style="color:#ef4444">JSON 格式错误：' + e.message + '</span>';
    return;
  }
  // 验证基本结构
  if (!importedData || typeof importedData !== 'object') {
    resultEl.innerHTML = '<span style="color:#ef4444">数据格式不正确，不是有效的 CRM 数据</span>';
    return;
  }
  if (!importedData.customers && !importedData.orders && !importedData.cards) {
    resultEl.innerHTML = '<span style="color:#ef4444">数据缺少必要字段（customers/orders/cards）</span>';
    return;
  }
  if (!confirm('确定导入数据？此操作将覆盖本机当前所有数据。\n\n导入前建议先点「导出数据」备份当前数据。')) return;
  window.APP.db = importedData;
  saveDB_localOnly();
  // 同步到云端（如果已配置）
  if (window.APP_FIREBASE_INITIALIZED) {
    saveToCloud(window.APP.db);
  }
  navigateTo('dashboard');
  resultEl.innerHTML = '<span style="color:#10b981">✅ 数据导入成功！已切换到工作台。</span>';
  showToast('数据导入成功！', 'success', 3000);
}



