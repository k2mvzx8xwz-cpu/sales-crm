/**
 * 产品销售.js - 销售客户管理系统 v3.4.2
 * 职责：产品销售数据管理（与商品管理同步）
 * 字段：成本价格、代理商价格、销售价格（红色）、状态（已下架红/已上架绿/待上架蓝）
 * 支持：批量删除、批量修改状态、客户展示页
 */

let psPage = 1;
let psKeyword = '';
let psSelected = []; // 已选中的商品ID列表

function renderProductSales() {
  const el = document.getElementById('page-product-sales');
  if (!el) return;
  const db = window.APP.db;
  const products = db.products || [];
  const salesData = db.productSalesData || {};

  // 搜索过滤
  let list = products.filter(p => {
    if (!psKeyword) return true;
    const kw = psKeyword.toLowerCase();
    return (p.name && p.name.toLowerCase().includes(kw)) ||
           (p.remark && p.remark.toLowerCase().includes(kw));
  });

  const pager = paginate(list, psPage, 15);

  el.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">📊 产品销售</h2>
      <div style="display:flex;gap:8px;">
        <button class="btn-danger" onclick="batchDeleteProductSales()" ${psSelected.length === 0 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>批量删除 (${psSelected.length})</button>
        <button class="btn-secondary" onclick="batchSetStatus()" ${psSelected.length === 0 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>批量修改状态</button>
      </div>
    </div>

    ${renderSalesTab(list, pager)}
  `;
  renderPager('ps-pager', pager, (p) => { psPage = p; renderProductSales(); });
}

function renderSalesTab(list, pager) {
  const db = window.APP.db;
  const salesData = db.productSalesData || {};

  return `
    <div class="toolbar">
      <div class="search-box">
        <input type="text" placeholder="搜索商品名称..." value="${psKeyword}"
          oninput="psKeyword=this.value;psPage=1;renderProductSales()">
      </div>
    </div>
    <div class="section-card">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:40px;"><input type="checkbox" onchange="toggleSelectAll(this)" ${list.length===0?'disabled':''}></th>
              <th>序号</th>
              <th>商品名称</th>
              <th>类型</th>
              <th>成本价格 (¥)</th>
              <th>代理商价格 (¥)</th>
              <th>销售价格 (¥)</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${pager.items.length === 0 ? `<tr><td colspan="9" class="empty-cell">暂无商品数据，请在"商品管理"中添加商品</td></tr>` :
              pager.items.map((p, idx) => {
                const sd = salesData[p.id] || {};
                const status = sd.status || 'draft';
                const statusLabel = { draft:'待上架', active:'已上架', inactive:'已下架' }[status] || '待上架';
                const statusClass = { draft:'badge-blue', active:'badge-green', inactive:'badge-red' }[status] || 'badge-blue';
                const priceColor = status === 'active' ? '#ef4444' : (status === 'inactive' ? '#94a3b8' : '#f59e0b');
                const isChecked = psSelected.includes(p.id);
                return `<tr>
                  <td><input type="checkbox" class="ps-checkbox" value="${p.id}" ${isChecked?'checked':''} onchange="onPsCheckChange('${p.id}', this.checked)"></td>
                  <td>${(psPage-1)*15+idx+1}</td>
                  <td style="white-space:normal;word-break:break-all;min-width:140px;max-width:240px;" title="${p.name}">${p.name}</td>
                  <td><span class="badge ${p.type==='software'?'badge-blue':'badge-green'}">${p.type==='software'?'软件':'硬件'}</span></td>
                  <td>¥${formatMoney(sd.costPrice != null ? sd.costPrice : (p.cost||0))}</td>
                  <td>¥${formatMoney(sd.agentPrice || 0)}</td>
                  <td style="color:${priceColor};font-weight:600;">¥${formatMoney(sd.salePrice != null ? sd.salePrice : (p.price||0))}</td>
                  <td><span class="badge ${statusClass}">${statusLabel}</span></td>
                  <td class="action-cell">
                    <button class="btn-xs btn-secondary" onclick="showEditProductSalesModal('${p.id}')">编辑</button>
                    <button class="btn-xs btn-danger" onclick="deleteProduct('${p.id}')">删除</button>
                  </td>
                </tr>`;
              }).join('')}
          </tbody>
        </table>
      </div>
      <div id="ps-pager"></div>
    </div>
  `;
}

// ==================== 复选框逻辑 ====================
function onPsCheckChange(id, checked) {
  if (checked) {
    if (!psSelected.includes(id)) psSelected.push(id);
  } else {
    psSelected = psSelected.filter(x => x !== id);
  }
  // 更新按钮状态
  const btns = document.querySelectorAll('.page-header [onclick^="batch"]');
  btns.forEach(btn => {
    btn.disabled = psSelected.length === 0;
    btn.style.opacity = psSelected.length === 0 ? '0.5' : '1';
    btn.style.cursor = psSelected.length === 0 ? 'not-allowed' : 'pointer';
  });
}

function toggleSelectAll(master) {
  const db = window.APP.db;
  let list = (db.products || []).filter(p => {
    if (!psKeyword) return true;
    const kw = psKeyword.toLowerCase();
    return (p.name && p.name.toLowerCase().includes(kw)) ||
           (p.remark && p.remark.toLowerCase().includes(kw));
  });
  if (master.checked) {
    psSelected = list.map(p => p.id);
  } else {
    psSelected = [];
  }
  document.querySelectorAll('.ps-checkbox').forEach(cb => { cb.checked = master.checked; });
  onPsCheckChange('', master.checked); // 仅刷新按钮状态
}

// ==================== 编辑产品销售数据 ====================
function showEditProductSalesModal(id) {
  const db = window.APP.db;
  const p = db.products.find(x => x.id === id);
  if (!p) return;
  const sd = (db.productSalesData || {})[id] || {};

  const content = `
    <p style="color:#94a3b8;font-size:13px;margin-bottom:16px">商品：${p.name}</p>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">成本价格 (¥)</label>
        <input type="number" class="form-input" id="psd-costPrice" step="0.01" value="${sd.costPrice != null ? sd.costPrice : (p.cost||0)}" placeholder="0.00">
      </div>
      <div class="form-group">
        <label class="form-label">代理商价格 (¥)</label>
        <input type="number" class="form-input" id="psd-agentPrice" step="0.01" value="${sd.agentPrice || 0}" placeholder="0.00">
      </div>
      <div class="form-group">
        <label class="form-label" style="color:#ef4444;font-weight:600;">销售价格 (¥)</label>
        <input type="number" class="form-input" id="psd-salePrice" step="0.01" value="${sd.salePrice != null ? sd.salePrice : (p.price||0)}" placeholder="0.00" style="color:#ef4444;font-weight:600;">
      </div>
      <div class="form-group">
        <label class="form-label">状态</label>
        <select class="form-select" id="psd-status">
          <option value="draft" ${(sd.status||'draft')==='draft'?'selected':''}>待上架（蓝）</option>
          <option value="active" ${(sd.status||'draft')==='active'?'selected':''}>已上架（绿）</option>
          <option value="inactive" ${(sd.status||'draft')==='inactive'?'selected':''}>已下架（红）</option>
        </select>
      </div>
    </div>
  `;

  showModal('编辑产品销售', content,
    `<button onclick="closeModal()" class="btn-secondary">取消</button>
     <button onclick="saveProductSales('${id}')" class="btn-primary">保存</button>`);
}

function saveProductSales(id) {
  const db = window.APP.db;
  if (!db.productSalesData) db.productSalesData = {};
  db.productSalesData[id] = {
    costPrice: parseFloat(document.getElementById('psd-costPrice')?.value) || 0,
    agentPrice: parseFloat(document.getElementById('psd-agentPrice')?.value) || 0,
    salePrice: parseFloat(document.getElementById('psd-salePrice')?.value) || 0,
    status: document.getElementById('psd-status')?.value || 'draft',
    _lastModified: Date.now() // 添加时间戳用于合并
  };
  // 立即保存到本地并强制同步到云端（不等待防抖）
  saveDB_localOnly();
  // 立即推送到云端
  if (window.APP_FIREBASE_INITIALIZED) {
    saveToCloud(window.APP.db);
  }
  closeModal();
  showToast('产品销售数据已保存');
  renderProductSales();
}

// ==================== 批量删除 ====================
function batchDeleteProductSales() {
  if (psSelected.length === 0) { showToast('请先选择商品', 'error'); return; }
  confirmDialog(`确定批量删除选中的 <b>${psSelected.length}</b> 个商品吗？<br><small style="color:#94a3b8">商品管理和产品销售数据将同步删除</small>`, () => {
    psSelected.forEach(id => {
      deleteProduct(id, true); // 传true表示批量删除，不逐个弹 toast
    });
    psSelected = [];
    showToast('批量删除完成');
    renderProductSales();
  }, '批量删除');
}

// ==================== 批量修改状态 ====================
function batchSetStatus() {
  if (psSelected.length === 0) { showToast('请先选择商品', 'error'); return; }
  const content = `
    <div class="form-group">
      <label class="form-label">将选中 ${psSelected.length} 个商品的状态修改为</label>
      <select class="form-select" id="batch-status-select">
        <option value="draft">待上架（蓝）</option>
        <option value="active">已上架（绿）</option>
        <option value="inactive">已下架（红）</option>
      </select>
    </div>
  `;
  showModal('批量修改状态', content,
    `<button onclick="closeModal()" class="btn-secondary">取消</button>
     <button onclick="execBatchSetStatus()" class="btn-primary">确认修改</button>`);
}

function execBatchSetStatus() {
  const db = window.APP.db;
  const newStatus = document.getElementById('batch-status-select')?.value || 'draft';
  const now = Date.now();
  if (!db.productSalesData) db.productSalesData = {};
  psSelected.forEach(id => {
    if (!db.productSalesData[id]) {
      const p = db.products.find(x => x.id === id);
      db.productSalesData[id] = {
        costPrice: p ? p.cost || 0 : 0,
        agentPrice: 0,
        salePrice: p ? p.price || 0 : 0,
        status: newStatus,
        _lastModified: now
      };
    } else {
      db.productSalesData[id].status = newStatus;
      db.productSalesData[id]._lastModified = now; // 更新时间戳
    }
  });
  // 更新整库时间戳，确保云端同步时能正确合并
  db._lastModified = now;
  // 立即保存到本地
  saveDB_localOnly();
  // 立即推送到云端（等待完成）
  if (window.APP_FIREBASE_INITIALIZED) {
    (async () => {
      try {
        await saveToCloud(window.APP.db);
        console.log('[批量修改状态] 云端同步完成');
      } catch (e) {
        console.error('[批量修改状态] 云端同步失败:', e.message);
      }
    })();
  }
  closeModal();
  showToast(`已批量修改 ${psSelected.length} 个商品状态`);
  psSelected = [];
  renderProductSales();
}
