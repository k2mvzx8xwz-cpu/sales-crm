/**
 * 产品销售.js - 销售客户管理系统 v3.4.2
 * 职责：产品销售数据管理（与商品管理同步）
 * 字段：成本价格、代理商价格、销售价格（红色）、状态（已下架红/已上架绿/待上架蓝）
 * 支持：批量删除、批量修改状态、客户展示页
 */

let psPage = 1;
let psKeyword = '';
let psSelected = []; // 已选中的商品ID列表
let psTab = 'sales'; // 'sales' | 'display'

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
      ${psTab === 'sales' ? `
      <div style="display:flex;gap:8px;">
        <button class="btn-danger" onclick="batchDeleteProductSales()" ${psSelected.length === 0 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>批量删除 (${psSelected.length})</button>
        <button class="btn-secondary" onclick="batchSetStatus()" ${psSelected.length === 0 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>批量修改状态</button>
      </div>` : ''}
    </div>
    <div class="tab-bar">
      <button class="tab-btn ${psTab==='sales'?'active':''}" onclick="setPsTab('sales')">数据编辑</button>
      <button class="tab-btn ${psTab==='display'?'active':''}" onclick="setPsTab('display')">客户展示页</button>
    </div>

    ${psTab === 'sales' ? renderSalesTab(list, pager) : renderDisplayTab(list)}
  `;
  // 分页器（仅销售数据标签）
  if (psTab === 'sales') {
    renderPager('ps-pager', pager, (p) => { psPage = p; renderProductSales(); });
  }
}

function setPsTab(tab) { psTab = tab; psPage = 1; psSelected = []; renderProductSales(); }

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
}(list) {
  const db = window.APP.db;
  const displayData = db.productDisplayData || {};

  return `
    <div class="toolbar">
      <div class="search-box">
        <input type="text" placeholder="搜索商品名称..." value="${psKeyword}"
          oninput="psKeyword=this.value;psPage=1;renderProductSales()">
      </div>
    </div>
    <div class="section-card">
      <div class="section-card-header">
        <span>📸 客户展示页（可截图发给客户，数据独立可修改，不影响系统统计）</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>商品名称</th>
              <th>类型</th>
              <th>显示成本</th>
              <th>下级价格</th>
              <th>销售价格</th>
              <th>备注</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="8" class="empty-cell">暂无商品</td></tr>` :
              list.map((p, idx) => {
                const d = displayData[p.id] || {};
                return `<tr>
                  <td>${idx+1}</td>
                  <td style="white-space:normal;word-break:break-all;min-width:140px;max-width:260px;" title="${p.name}">${p.name}</td>
                  <td><span class="badge ${p.type==='software'?'badge-blue':'badge-green'}">${p.type==='software'?'软件':'硬件'}</span></td>
                  <td>¥${d.displayCost || formatMoney(p.price)}</td>
                  <td>¥${d.subPrice || '-'}</td>
                  <td>¥${d.salePrice || formatMoney(p.price)}</td>
                  <td style="white-space:normal;word-break:break-all;min-width:100px;max-width:200px;color:#94a3b8;font-size:12px;">${p.remark||'-'}</td>
                  <td class="action-cell">
                    <button class="btn-xs btn-secondary" onclick="showEditDisplayProduct('${p.id}')">编辑展示</button>
                    <button class="btn-xs btn-danger" onclick="deleteProduct('${p.id}')">删除</button>
                  </td>
                </tr>`;
              }).join('')}
          </tbody>
        </table>
      </div>
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
    status: document.getElementById('psd-status')?.value || 'draft'
  };
  saveDB();
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

// ==================== 编辑客户展示数据 ====================
function showEditDisplayProduct(id) {
  const db = window.APP.db;
  const p = db.products.find(p => p.id === id);
  if (!p) return;
  const d = (db.productDisplayData || {})[id] || {};

  const content = `
    <p style="color:#94a3b8;font-size:13px;margin-bottom:16px">商品：${p.name}</p>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">显示成本价</label>
        <input type="text" class="form-input" id="dd-cost" value="${d.displayCost||formatMoney(p.price)}" placeholder="客户看到的成本">
      </div>
      <div class="form-group">
        <label class="form-label">下级价格</label>
        <input type="text" class="form-input" id="dd-sub" value="${d.subPrice||''}" placeholder="代理/下级价格（虚构）">
      </div>
      <div class="form-group">
        <label class="form-label">销售价格</label>
        <input type="text" class="form-input" id="dd-sale" value="${d.salePrice||formatMoney(p.price)}" placeholder="客户看到的售价（虚构）">
      </div>
    </div>
  `;

  showModal('编辑展示数据', content,
    `<button onclick="closeModal()" class="btn-secondary">取消</button>
     <button onclick="saveDisplayProduct('${id}')" class="btn-primary">保存</button>`);
}

function saveDisplayProduct(id) {
  const db = window.APP.db;
  if (!db.productDisplayData) db.productDisplayData = {};
  db.productDisplayData[id] = {
    displayCost: document.getElementById('dd-cost')?.value || '',
    subPrice: document.getElementById('dd-sub')?.value || '',
    salePrice: document.getElementById('dd-sale')?.value || ''
  };
  saveDB();
  closeModal();
  showToast('展示数据已保存');
  renderProductSales();
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
  if (!db.productSalesData) db.productSalesData = {};
  psSelected.forEach(id => {
    if (!db.productSalesData[id]) {
      const p = db.products.find(x => x.id === id);
      db.productSalesData[id] = {
        costPrice: p ? p.cost || 0 : 0,
        agentPrice: 0,
        salePrice: p ? p.price || 0 : 0,
        status: newStatus
      };
    } else {
      db.productSalesData[id].status = newStatus;
    }
  });
  saveDB();
  closeModal();
  showToast(`已批量修改 ${psSelected.length} 个商品状态`);
  psSelected = [];
  renderProductSales();
}
