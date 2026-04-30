/**
 * 扩展功能.js - 销售客户管理系统 v3.0.0
 * 职责：换卡功能、换设备功能、物流查询
 */

// ==================== 换卡功能 ====================
function showChangeCardModal(orderId) {
  const db = window.APP.db;
  const order = db.orders.find(o => o.id === orderId);
  if (!order) return;

  const unusedCards = (db.cards || []).filter(c => c.status === 'unused');

  const content = `
    <div style="margin-bottom:16px;padding:12px;background:#0f172a;border-radius:8px;">
      <div style="color:#94a3b8;font-size:12px;margin-bottom:4px">当前卡密</div>
      <div style="color:#7dd3fc;font-family:monospace">${order.cardCode || '(未绑定卡密)'}</div>
    </div>
    <div class="form-group">
      <label class="form-label required">新卡密</label>
      <div style="position:relative">
        <input type="text" class="form-input" id="nc-search" placeholder="输入关键字搜索卡密..." oninput="searchNewCardDropdown(this.value)" autocomplete="off">
        <div id="nc-dropdown" class="custom-dropdown" style="display:none;"></div>
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
  let cards = (db.cards || []).filter(c => c.status === 'unused');
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



