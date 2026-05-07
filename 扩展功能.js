/**
 * 扩展功能.js - 销售客户管理系统 v5.16.0
 * 职责：换卡功能、换设备功能、物流查询、数据备份导出导入
 */

// ==================== 换卡功能 ====================
function showChangeCardModal(orderId) {
  const db = window.APP.db;
  const order = db.orders.find(o => o.id === orderId);
  if (!order) return;

  const unusedCards = (db.cards || []).filter(c => c.status === 'unused');
  
  // 计算各分类库存
  const catStock = {
    temp: unusedCards.filter(c => c.category === 'temp').length,
    monthly: unusedCards.filter(c => c.category === 'monthly').length,
    quarterly: unusedCards.filter(c => c.category === 'quarterly').length,
    halfyear: unusedCards.filter(c => c.category === 'halfyear').length,
    yearly: unusedCards.filter(c => c.category === 'yearly').length,
    permanent: unusedCards.filter(c => c.category === 'permanent').length
  };

  const content = `
    <div style="margin-bottom:16px;padding:12px;background:#0f172a;border-radius:8px;">
      <div style="color:#94a3b8;font-size:12px;margin-bottom:4px">当前卡密</div>
      <div style="color:#7dd3fc;font-family:monospace">${order.cardCode || '(未绑定卡密)'}</div>
    </div>
    
    <!-- 卡密库存显示 -->
    <div style="margin-bottom:16px;padding:10px 12px;background:#1e293b;border-radius:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      <span style="color:#94a3b8;font-size:12px">可用库存：</span>
      <span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:12px;font-size:11px;">临 ${catStock.temp}</span>
      <span style="background:#dbeafe;color:#2563eb;padding:2px 8px;border-radius:12px;font-size:11px;">月 ${catStock.monthly}</span>
      <span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:12px;font-size:11px;">季 ${catStock.quarterly}</span>
      <span style="background:#e0e7ff;color:#4f46e5;padding:2px 8px;border-radius:12px;font-size:11px;">半 ${catStock.halfyear}</span>
      <span style="background:#fce7f3;color:#db2777;padding:2px 8px;border-radius:12px;font-size:11px;">年 ${catStock.yearly}</span>
      <span style="background:#f3e8ff;color:#7c3aed;padding:2px 8px;border-radius:12px;font-size:11px;">永 ${catStock.permanent}</span>
    </div>
    
    <div class="form-group">
      <label class="form-label required">新卡密</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <select class="form-select" id="nc-catFilter" style="width:100px" onchange="searchNewCardDropdown(document.getElementById('nc-search').value)">
          <option value="">全部分类</option>
          <option value="temp">临时卡</option>
          <option value="monthly">月卡</option>
          <option value="quarterly">季卡</option>
          <option value="halfyear">半年卡</option>
          <option value="yearly">年卡</option>
          <option value="permanent">永久卡</option>
        </select>
        <div style="position:relative;flex:1;min-width:180px;">
          <input type="text" class="form-input" id="nc-search" placeholder="输入关键字搜索卡密..." oninput="searchNewCardDropdown(this.value)" autocomplete="off">
          <div id="nc-dropdown" class="custom-dropdown" style="display:none;"></div>
        </div>
      </div>
      <input type="hidden" id="nc-cardId">
      <div id="nc-selected" style="display:none;margin-top:8px;padding:8px;background:#0f172a;border-radius:6px;display:flex;align-items:center;gap:8px;">
        <span style="color:#94a3b8;font-size:12px">已选：</span>
        <span id="nc-selected-text" class="mono" style="color:#7dd3fc"></span>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">换卡原因</label>
      <textarea class="form-textarea" id="nc-reason" placeholder="请填写换卡原因（可选）"></textarea>
    </div>
    <div style="color:#f59e0b;font-size:12px;background:rgba(245,158,11,0.1);border-radius:6px;padding:8px 12px;border-left:3px solid #f59e0b">
      ⚠️ 换卡后：旧卡密状态→已替换，新卡密状态→已使用，同步更新订单信息
    </div>
  `;

  showModal('换卡', content,
    `<button onclick="closeModal()" class="btn-secondary">取消</button>
     <button onclick="doChangeCard('${orderId}')" class="btn-warning">确认换卡</button>`);
}

function searchNewCardDropdown(keyword) {
  const db = window.APP.db;
  const catFilter = document.getElementById('nc-catFilter')?.value || '';
  let cards = (db.cards || []).filter(c => c.status === 'unused');
  
  if (catFilter) cards = cards.filter(c => c.category === catFilter);
  if (keyword) cards = cards.filter(c => c.cardCode?.toLowerCase().includes(keyword.toLowerCase()));

  const dropdown = document.getElementById('nc-dropdown');
  if (!dropdown) return;

  dropdown.innerHTML = cards.slice(0, 15).map(c => `
    <div class="dropdown-item" onclick="selectNewCard('${c.id}','${c.cardCode.replace(/'/g,"\\'")}')">
      <span class="mono">${c.cardCode}</span>
      <span class="badge badge-gray" style="margin-left:8px">${getCardCategoryLabel(c.category)}</span>
    </div>
  `).join('') || '<div class="dropdown-item" style="color:#94a3b8">无可用卡密</div>';

  dropdown.style.display = 'block';
}

function selectNewCard(id, code) {
  document.getElementById('nc-cardId').value = id;
  document.getElementById('nc-search').value = code;
  document.getElementById('nc-dropdown').style.display = 'none';
  const sel = document.getElementById('nc-selected');
  if (sel) sel.style.display = 'flex';
  const txt = document.getElementById('nc-selected-text');
  if (txt) txt.textContent = code;
}

function doChangeCard(orderId) {
  const db = window.APP.db;
  const order = db.orders.find(o => o.id === orderId);
  if (!order) return;

  const newCardId = document.getElementById('nc-cardId')?.value;
  const newCardCode = document.getElementById('nc-search')?.value?.trim();
  const reason = document.getElementById('nc-reason')?.value?.trim() || '';

  if (!newCardCode) { showToast('请选择或输入新卡密', 'error'); return; }

  const oldCardCode = order.cardCode || '';
  const oldCardId = order.cardId || '';

  // 更新旧卡密状态
  if (oldCardId) {
    const oldCard = db.cards.find(c => c.id === oldCardId);
    if (oldCard) oldCard.status = 'replaced';
  } else if (oldCardCode) {
    const oldCard = db.cards.find(c => c.cardCode === oldCardCode);
    if (oldCard) oldCard.status = 'replaced';
  }

  // 更新新卡密状态
  let newCard = null;
  if (newCardId) {
    newCard = db.cards.find(c => c.id === newCardId);
  }
  if (!newCard && newCardCode) {
    newCard = db.cards.find(c => c.cardCode === newCardCode);
  }

  if (newCard) {
    newCard.status = 'used';
    newCard.relatedOrderNo = order.orderNo;
    newCard.relatedWechatName = order.wechatName || '';
    newCard.relatedWechatId = order.wechatId || '';
  } else {
    // 新卡密不在库中，自动添加
    const autoCard = {
      id: genId(),
      category: order.cardCategory || 'monthly',
      cardCode: newCardCode,
      purchaseDate: todayStr(),
      expireDate: '',
      status: 'used',
      note: '换卡自动添加',
      relatedOrderNo: order.orderNo,
      relatedWechatName: order.wechatName || '',
      relatedWechatId: order.wechatId || '',
      createdAt: Date.now()
    };
    db.cards.push(autoCard);
    newCard = autoCard;
  }

  // 记录换卡历史
  if (!order.cardHistory) order.cardHistory = [];
  order.cardHistory.push({
    oldCard: oldCardCode,
    newCard: newCardCode,
    time: Date.now(),
    note: reason
  });

  // 更新订单卡密信息
  order.cardCode = newCardCode;
  order.cardId = newCard.id;

  // 记录到购卡记录
  db.cardRecords = db.cardRecords || [];
  db.cardRecords.push({
    id: genId(),
    customerId: order.customerId,
    orderNo: order.orderNo,
    cardCode: newCardCode,
    oldCardCode: oldCardCode,
    category: order.cardCategory || '',
    expireDate: order.expireDate || '',
    opDate: todayStr(),
    opType: 'replace',
    note: reason,
    createdAt: Date.now()
  });

  saveDB();
  closeModal();
  showToast('换卡成功');
  renderOrders();
}

// ==================== 换设备功能（硬件订单） ====================
function showChangeDeviceModal(orderId) {
  const db = window.APP.db;
  const order = db.orders.find(o => o.id === orderId);
  if (!order) return;

  const content = `
    <div style="margin-bottom:16px;padding:12px;background:#0f172a;border-radius:8px;color:#94a3b8;font-size:13px">
      原设备：${order.phoneBrand||''} ${order.phoneModel||''} 插口：${order.portType||'-'}
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">更换原因</label>
        <input type="text" class="form-input" id="cd-reason" placeholder="更换原因">
      </div>
      <div class="form-group">
        <label class="form-label">旧设备信息</label>
        <input type="text" class="form-input" id="cd-oldDevice" value="${(order.phoneBrand||'')+' '+(order.phoneModel||'')}" placeholder="旧设备描述">
      </div>
      <div class="form-group">
        <label class="form-label required">新设备手机品牌</label>
        <select class="form-select" id="cd-newBrand">
          <option value="">请选择</option>
          ${PHONE_BRANDS.map(b=>`<option value="${b}">${b}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label required">新设备手机型号</label>
        <input type="text" class="form-input" id="cd-newModel" placeholder="新设备型号" oninput="autoDetectPortForDevice(this.value)">
      </div>
      <div class="form-group">
        <label class="form-label">新设备插口类型</label>
        <div class="quick-btns">
          <button type="button" class="quick-btn" onclick="setDevicePort('C')">C口</button>
          <button type="button" class="quick-btn" onclick="setDevicePort('L')">L口</button>
          <button type="button" class="quick-btn" onclick="setDevicePort('CL')">CL双口</button>
          <button type="button" class="quick-btn" onclick="setDevicePort('BT')">蓝牙</button>
        </div>
        <input type="hidden" id="cd-portType">
      </div>
      <div class="form-group">
        <label class="form-label">搭配软件产品</label>
        <input type="text" class="form-input" id="cd-matchSoftware" value="${order.matchSoftware||''}" placeholder="搭配使用的软件产品">
      </div>
    </div>
  `;

  showModal('更换设备', content,
    `<button onclick="closeModal()" class="btn-secondary">取消</button>
     <button onclick="doChangeDevice('${orderId}')" class="btn-warning">确认更换</button>`);
}

function autoDetectPortForDevice(model) {
  const port = detectIphonePort(model);
  if (port) {
    document.getElementById('cd-portType').value = port;
    document.querySelectorAll('#cd-portType').forEach(() => {});
  }
}

function setDevicePort(type) {
  document.getElementById('cd-portType').value = type;
  event?.target?.closest('.quick-btns')?.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
  event?.target?.classList.add('active');
}

function doChangeDevice(orderId) {
  const db = window.APP.db;
  const order = db.orders.find(o => o.id === orderId);
  if (!order) return;

  const newBrand = document.getElementById('cd-newBrand')?.value;
  const newModel = document.getElementById('cd-newModel')?.value?.trim();
  if (!newModel) { showToast('请填写新设备型号', 'error'); return; }

  const oldDevice = document.getElementById('cd-oldDevice')?.value || `${order.phoneBrand||''} ${order.phoneModel||''}`;
  const reason = document.getElementById('cd-reason')?.value?.trim() || '';
  const newPortType = document.getElementById('cd-portType')?.value || detectIphonePort(newModel) || order.portType;
  const matchSoftware = document.getElementById('cd-matchSoftware')?.value?.trim() || order.matchSoftware || '';

  if (!order.deviceHistory) order.deviceHistory = [];
  order.deviceHistory.push({
    oldDevice,
    newDevice: `${newBrand||''} ${newModel}`,
    reason,
    matchSoftware,
    time: Date.now()
  });

  order.phoneBrand = newBrand || order.phoneBrand;
  order.phoneModel = newModel;
  order.portType = newPortType;
  order.matchSoftware = matchSoftware;

  saveDB();
  closeModal();
  showToast('设备信息已更新');
  renderOrders();
}

// ==================== 物流查询 ====================
async function queryExpressTracking(orderId) {
  const db = window.APP.db;
  const order = db.orders.find(o => o.id === orderId);
  if (!order) return;

  if (!order.trackingNo) { showToast('请先填写物流单号', 'warning'); return; }

  const customer = db.settings?.expressCustomer;
  const apiKey = db.settings?.expressKey;
  if (!customer || !apiKey) {
    showModal('物流查询', `
      <div style="color:var(--text-secondary);text-align:center;padding:20px;">
        <div style="font-size:40px;margin-bottom:12px">🚚</div>
        <p>物流查询功能需要配置快递API密钥</p>
        <p style="font-size:12px;margin-top:8px">请前往系统设置配置快递100 Customer ID和API密钥</p>
        <button class="btn-primary" style="margin-top:16px" onclick="closeModal();navigateTo('settings')">去配置</button>
      </div>
    `, `<button onclick="closeModal()" class="btn-secondary">关闭</button>`);
    return;
  }

  // 显示加载中
  showModal('物流查询', `
    <div style="text-align:center;padding:40px;color:var(--text-secondary)">
      <div style="font-size:30px;margin-bottom:12px;animation:spin 1s linear infinite">🔄</div>
      <p>正在查询物流信息...</p>
      <p style="font-size:12px;margin-top:8px">单号：${order.trackingNo}</p>
    </div>
  `);

  try {
    const company = getExpressCode(order.expressCompany || '');
    // 通过本地代理调用快递100 API（服务端处理签名并转发，避免CORS限制）
    const resp = await fetch(`/api/express?com=${company}&num=${encodeURIComponent(order.trackingNo)}`);
    const data = await resp.json();

    closeModal();
    const fallbackUrl = `https://www.kuaidi100.com/chaxun?com=${company}&nu=${order.trackingNo}`;

    if (data.status === '200' && data.data && data.data.length > 0) {
      const rows = data.data.map(item => `
        <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="min-width:130px;color:var(--text-muted);font-size:13px;">${item.ftime||item.time||''}</div>
          <div style="flex:1;color:var(--text-primary);font-size:14px;">${item.context||''}</div>
        </div>
      `).join('');
      showModal('物流查询', `
        <div style="padding:12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;margin-bottom:16px">
          <div style="color:var(--text-muted);font-size:12px">物流单号</div>
          <div class="mono" style="color:var(--link-color)">${order.trackingNo}</div>
          <div style="color:var(--text-muted);font-size:12px;margin-top:8px">快递公司</div>
          <div style="color:var(--text-primary)">${order.expressCompany || '未知'}</div>
        </div>
        <div style="margin-bottom:16px">${rows}</div>
        <a href="${fallbackUrl}" target="_blank" class="link">在快递100网站查看 →</a>
      `, `<button onclick="closeModal()" class="btn-secondary">关闭</button>`);
    } else {
      showModal('物流查询', `
        <div style="padding:12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;margin-bottom:16px">
          <div style="color:var(--text-muted);font-size:12px">物流单号</div>
          <div class="mono" style="color:var(--link-color)">${order.trackingNo}</div>
        </div>
        <div style="color:var(--text-muted);padding:16px 0">${data.message || '暂无物流信息'}</div>
        <a href="${fallbackUrl}" target="_blank" class="link">在快递100网站查看 →</a>
      `, `<button onclick="closeModal()" class="btn-secondary">关闭</button>`);
    }
  } catch (e) {
    closeModal();
    showToast('物流查询失败：' + (e.message || '网络错误，请检查快递100配置是否正确'), 'error');
  }
}

// 快递公司编码映射
function getExpressCode(name) {
  const map = {
    '顺丰速运': 'shunfeng', '圆通速递': 'yuantong', '中通快递': 'zhongtong',
    '韵达快递': 'yunda', '申通快递': 'shentong', '百世快递': 'huitongkuaidi',
    '极兔速运': 'jtexpress', '邮政EMS': 'ems', '京东物流': 'jd', '德邦快递': 'debangkuaidi'
  };
  return map[name] || 'auto';
}

// ==================== 数据备份与导出导入 ====================
// 显示数据管理面板
function showDataManagement() {
  const db = window.APP.db;
  const lastBackup = localStorage.getItem('crm_lastBackup') || '暂无记录';
  const cats = ['temp','monthly','quarterly','halfyear','yearly','permanent'];
  const catUnusedCounts = {};
  cats.forEach(cat => {
    catUnusedCounts[cat] = (db.cards||[]).filter(c => c.category === cat && c.status === 'unused').length;
  });
  const totalUnused = (db.cards||[]).filter(c => c.status === 'unused').length;

  const content = `
    <div style="display:grid;gap:16px">
      <!-- 备份卡片 -->
      <div style="padding:16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <span style="font-size:18px">💾</span>
          <h4 style="margin:0">数据备份</h4>
        </div>
        <div style="color:var(--text-muted);font-size:12px;margin-bottom:12px">
          上次备份时间：<span id="dm-lastBackup" style="color:var(--link-color)">${lastBackup}</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="doManualBackup()" class="btn-primary" style="display:flex;align-items:center;gap:6px">
            <span>📦</span> 立即备份
          </button>
          <label class="btn-secondary" style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <span>📂</span> 导入备份
            <input type="file" accept=".json" style="display:none" onchange="doImportBackup(this)">
          </label>
        </div>
      </div>

      <!-- 导出卡片 -->
      <div style="padding:16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <span style="font-size:18px">📤</span>
          <h4 style="margin:0">数据导出</h4>
        </div>
        <div style="color:var(--text-muted);font-size:12px;margin-bottom:12px">
          将数据导出为JSON文件，可用于数据迁移或存档
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="doExportAllData()" class="btn-primary" style="display:flex;align-items:center;gap:6px">
            <span>⬇</span> 导出全部数据
          </button>
          <button onclick="showExportOptions()" class="btn-secondary" style="display:flex;align-items:center;gap:6px">
            <span>🎯</span> 选择性导出
          </button>
        </div>
      </div>

      <!-- 导入卡片 -->
      <div style="padding:16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <span style="font-size:18px">📥</span>
          <h4 style="margin:0">数据导入</h4>
        </div>
        <div style="color:var(--text-muted);font-size:12px;margin-bottom:12px">
          从JSON文件导入数据，支持合并或覆盖模式
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <label class="btn-secondary" style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <span>📂</span> 导入JSON数据
            <input type="file" accept=".json" style="display:none" onchange="doImportData(this)">
          </label>
        </div>
      </div>

      <!-- 数据统计 -->
      <div style="padding:16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <span style="font-size:18px">📊</span>
          <h4 style="margin:0">数据统计</h4>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
          <div style="padding:8px;background:var(--bg-primary);border-radius:6px">
            <div style="color:var(--text-muted);font-size:11px">客户总数</div>
            <div style="color:var(--link-color);font-size:18px;font-weight:600">${(db.customers||[]).length}</div>
          </div>
          <div style="padding:8px;background:var(--bg-primary);border-radius:6px">
            <div style="color:var(--text-muted);font-size:11px">订单总数</div>
            <div style="color:var(--link-color);font-size:18px;font-weight:600">${(db.orders||[]).length}</div>
          </div>
          <div style="padding:8px;background:var(--bg-primary);border-radius:6px">
            <div style="color:var(--text-muted);font-size:11px">卡密总数</div>
            <div style="color:var(--link-color);font-size:18px;font-weight:600">${(db.cards||[]).length}</div>
          </div>
          <div style="padding:8px;background:var(--bg-primary);border-radius:6px">
            <div style="color:var(--text-muted);font-size:11px">卡密库存</div>
            <div style="color:#10b981;font-size:18px;font-weight:600">${totalUnused}</div>
          </div>
          <div style="padding:8px;background:var(--bg-primary);border-radius:6px">
            <div style="color:var(--text-muted);font-size:11px">商品总数</div>
            <div style="color:var(--link-color);font-size:18px;font-weight:600">${(db.products||[]).length}</div>
          </div>
          <div style="padding:8px;background:var(--bg-primary);border-radius:6px">
            <div style="color:var(--text-muted);font-size:11px">无效卡密</div>
            <div style="color:#ef4444;font-size:18px;font-weight:600">${(db.cards||[]).filter(c=>c.status==='invalid'||c.status==='expired').length}</div>
          </div>
        </div>
      </div>

      <div style="color:#f59e0b;font-size:12px;background:rgba(245,158,11,0.1);border-radius:6px;padding:8px 12px;border-left:3px solid #f59e0b">
        ⚠️ 导入数据会合并现有数据，如需完全覆盖请先备份当前数据
      </div>
    </div>
  `;

  showModal('数据管理', content, `<button onclick="closeModal()" class="btn-secondary">关闭</button>`, 'lg');
}

// 显示导出选项
function showExportOptions() {
  const content = `
    <div style="display:grid;gap:12px">
      <div class="export-option" onclick="doExportData('customers')">
        <span class="export-icon">👥</span>
        <div><div style="font-weight:600">客户数据</div><div style="font-size:12px;color:var(--text-muted)">导出所有客户信息</div></div>
      </div>
      <div class="export-option" onclick="doExportData('orders')">
        <span class="export-icon">📋</span>
        <div><div style="font-weight:600">订单数据</div><div style="font-size:12px;color:var(--text-muted)">导出所有订单记录</div></div>
      </div>
      <div class="export-option" onclick="doExportData('cards')">
        <span class="export-icon">🔑</span>
        <div><div style="font-weight:600">卡密数据</div><div style="font-size:12px;color:var(--text-muted)">导出所有卡密信息</div></div>
      </div>
      <div class="export-option" onclick="doExportData('products')">
        <span class="export-icon">📦</span>
        <div><div style="font-weight:600">商品数据</div><div style="font-size:12px;color:var(--text-muted)">导出所有商品信息</div></div>
      </div>
    </div>
  `;
  showModal('选择性导出', content, `<button onclick="closeModal()" class="btn-secondary">取消</button>`);
}

// 执行手动备份
function doManualBackup() {
  const db = window.APP.db;
  const backupData = JSON.parse(JSON.stringify(db));
  backupData._backupMeta = {
    version: 'v5.16.0',
    time: getFullDatetime(),
    timestamp: Date.now(),
    type: 'manual'
  };

  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sales_crm_backup_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}.json`;
  a.click();
  URL.revokeObjectURL(url);

  localStorage.setItem('crm_lastBackup', getFullDatetime());
  document.getElementById('dm-lastBackup').textContent = getFullDatetime();
  showToast('备份已保存到本地', 'success');
}

// 执行导入备份（覆盖模式）
function doImportBackup(fileInput) {
  const file = fileInput.files[0];
  if (!file) return;

  if (!confirm(`确定要导入备份文件 "${file.name}" 吗？\n这将完全覆盖当前所有数据！\n建议先手动备份一次。`)) {
    fileInput.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data._backupMeta) {
        showToast('无效的备份文件格式', 'error');
        return;
      }

      // 覆盖所有数据
      const keys = ['customers', 'orders', 'cards', 'products', 'cardRecords', 'settings', 'custom_fields', 'brands', 'sw_tpl', 'hw_tpl', 'productSalesData'];
      keys.forEach(key => {
        if (data[key] !== undefined) {
          window.APP.db[key] = data[key];
        }
      });

      // 保存到localStorage
      keys.forEach(key => {
        localStorage.setItem('crm_' + key, JSON.stringify(window.APP.db[key] || []));
      });

      // 刷新页面以重新渲染
      showToast('数据已成功导入，正在刷新...', 'success');
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      showToast('导入失败：' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  fileInput.value = '';
}

// 导出全部数据
function doExportAllData() {
  const db = window.APP.db;
  const exportData = JSON.parse(JSON.stringify(db));
  exportData._exportMeta = {
    version: 'v5.16.0',
    time: getFullDatetime(),
    timestamp: Date.now(),
    type: 'full'
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sales_crm_export_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('数据导出成功', 'success');
}

// 选择性导出数据
function doExportData(type) {
  const db = window.APP.db;
  const data = {
    _exportMeta: {
      version: 'v5.16.0',
      time: getFullDatetime(),
      timestamp: Date.now(),
      type: type
    }
  };

  switch(type) {
    case 'customers': data.customers = db.customers || []; break;
    case 'orders': data.orders = db.orders || []; break;
    case 'cards': data.cards = db.cards || []; break;
    case 'products': data.products = db.products || []; break;
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sales_crm_${type}_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  closeModal();
  showToast(type + ' 数据导出成功', 'success');
}

// 导入JSON数据（合并模式）
function doImportData(fileInput) {
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);

      if (!confirm(`确定要导入 "${file.name}" 吗？\n数据将合并到现有数据中。`)) {
        fileInput.value = '';
        return;
      }

      let mergedCount = 0;
      const keys = ['customers', 'orders', 'cards', 'products', 'cardRecords'];

      keys.forEach(key => {
        if (Array.isArray(data[key])) {
          const existingIds = new Set((window.APP.db[key]||[]).map(item => item.id));
          data[key].forEach(item => {
            if (!existingIds.has(item.id)) {
              window.APP.db[key].push(item);
              mergedCount++;
            }
          });
          localStorage.setItem('crm_' + key, JSON.stringify(window.APP.db[key]));
        }
      });

      showToast(`成功合并 ${mergedCount} 条新数据`, 'success');
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      showToast('导入失败：' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  fileInput.value = '';
}

// 自动备份检查（每天首次打开时自动备份，保留最近7天）
function checkAutoBackup() {
  const lastAutoBackup = localStorage.getItem('crm_lastAutoBackup') || '';
  const today = formatDate(new Date(), 'YYYY-MM-DD');
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoffDate = formatDate(sevenDaysAgo, 'YYYY-MM-DD');

  if (lastAutoBackup !== today) {
    const db = window.APP.db;
    const backupData = JSON.parse(JSON.stringify(db));
    backupData._backupMeta = {
      version: 'v5.16.0',
      time: getFullDatetime(),
      timestamp: Date.now(),
      type: 'auto'
    };

    const backups = JSON.parse(localStorage.getItem('crm_autoBackups') || '[]');
    
    // 过滤掉7天以前的备份数据
    const filteredBackups = backups.filter(b => b.date >= cutoffDate);
    
    // 添加今日备份
    filteredBackups.push({
      date: today,
      time: getFullDatetime(),
      data: backupData
    });

    // 最多保留7天备份（每天1个）
    while (filteredBackups.length > 7) filteredBackups.shift();
    
    localStorage.setItem('crm_autoBackups', JSON.stringify(filteredBackups));
    localStorage.setItem('crm_lastAutoBackup', today);
    console.log(`[自动备份] 今日自动备份已完成，保留${filteredBackups.length}天备份`);
  }
}

setTimeout(checkAutoBackup, 2000);



