/**
 * 商品管理.js - 销售客户管理系统 v3.3.0
 * 职责：商品列表（双页面：客户展示页+真实数据页）、新增/编辑/删除
 * 调整：客户展示页商品名称换行完整显示（含商品类型列）
 */

let productTab = 'real'; // 'real' | 'display'

function renderProducts() {
  const el = document.getElementById('page-products');
  if (!el) return;
  const db = window.APP.db;
  const products = db.products || [];

  el.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">商品管理</h2>
      <button class="btn-primary" onclick="showAddProductModal()">+ 新增商品</button>
    </div>
    <div class="tab-bar">
      <button class="tab-btn ${productTab==='real'?'active':''}" onclick="setProductTab('real')">真实数据页（系统核心）</button>
      <button class="tab-btn ${productTab==='display'?'active':''}" onclick="setProductTab('display')">客户展示页（截图用）</button>
    </div>

    ${productTab === 'real' ? renderRealProductsTab(products) : renderDisplayProductsTab(products, db)}
  `;
}

function setProductTab(tab) { productTab = tab; renderProducts(); }

function renderRealProductsTab(products) {
  const swProds = products.filter(p => p.type === 'software');
  const hwProds = products.filter(p => p.type === 'hardware');

  return `
    <div class="section-card">
      <div class="section-card-header"><span>💾 真实数据（与系统同步，用于成本利润计算）</span></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>序号</th><th>商品名称</th><th>类型</th><th>售价</th><th>成本</th><th>利润</th><th>操作</th></tr></thead>
          <tbody>
            ${products.length === 0 ? `<tr><td colspan="7" class="empty-cell">暂无商品</td></tr>` :
              products.map((p, idx) => `<tr>
                <td>${idx+1}</td>
                <td style="white-space:normal;word-break:break-all;min-width:160px;max-width:300px;" title="${p.name}">${p.name}</td>
                <td><span class="badge ${p.type==='software'?'badge-blue':'badge-green'}">${p.type==='software'?'软件':'硬件'}</span></td>
                <td>¥${formatMoney(p.price)}</td>
                <td>¥${formatMoney(p.cost)}</td>
                <td class="text-success">¥${formatMoney((p.price||0)-(p.cost||0))}</td>
                <td class="action-cell">
                  <button class="btn-xs btn-secondary" onclick="showEditProductModal('${p.id}')">编辑</button>
                  <button class="btn-xs btn-danger" onclick="deleteProduct('${p.id}')">删除</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderDisplayProductsTab(products, db) {
  const displayData = db.productDisplayData || {};

  return `
    <div class="section-card">
      <div class="section-card-header">
        <span>📸 客户展示页（可截图发给客户，数据独立可修改，不影响系统统计）</span>
        <span class="text-muted" style="font-size:12px">点击"编辑展示"修改客户可见的价格信息</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>序号</th><th>商品名称</th><th>商品类型</th><th>显示成本</th><th>下级价格</th><th>销售价格</th><th>操作</th></tr></thead>
          <tbody>
            ${products.length === 0 ? `<tr><td colspan="7" class="empty-cell">暂无商品</td></tr>` :
              products.map((p, idx) => {
                const d = displayData[p.id] || {};
                return `<tr>
                  <td>${idx+1}</td>
                  <td style="white-space:normal;word-break:break-all;min-width:140px;max-width:260px;" title="${p.name}">${p.name}</td>
                  <td><span class="badge ${p.type==='software'?'badge-blue':'badge-green'}">${p.type==='software'?'软件':'硬件'}</span></td>
                  <td>¥${d.displayCost || formatMoney(p.price)}</td>
                  <td>¥${d.subPrice || '-'}</td>
                  <td>¥${d.salePrice || formatMoney(p.price)}</td>
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

// ==================== 新增商品 ====================
function showAddProductModal(prefill = {}) {
  const isEdit = !!prefill.id;
  const content = `
    <form id="product-form">
      <div class="form-grid">
        <div class="form-group form-full">
          <label class="form-label required">商品名称</label>
          <input type="text" class="form-input" id="pf-name" value="${prefill.name||''}" placeholder="商品名称" required>
        </div>
        <div class="form-group">
          <label class="form-label required">类型</label>
          <select class="form-select" id="pf-type">
            <option value="software" ${(prefill.type||'software')==='software'?'selected':''}>软件产品</option>
            <option value="hardware" ${prefill.type==='hardware'?'selected':''}>硬件产品</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">售价 (¥)</label>
          <input type="number" class="form-input" id="pf-price" step="0.01" value="${prefill.price||''}" placeholder="0.00">
        </div>
        <div class="form-group">
          <label class="form-label">成本 (¥)</label>
          <input type="number" class="form-input" id="pf-cost" step="0.01" value="${prefill.cost||''}" placeholder="0.00">
        </div>
      </div>
    </form>
  `;

  showModal(isEdit ? '编辑商品' : '新增商品', content,
    `<button onclick="closeModal()" class="btn-secondary">取消</button>
     <button onclick="saveProduct(${isEdit?`'${prefill.id}'`:'null'})" class="btn-primary">${isEdit?'保存修改':'保存商品'}</button>`);
}

function saveProduct(editId = null) {
  const name = document.getElementById('pf-name')?.value?.trim();
  if (!name) { showToast('商品名称不能为空', 'error'); return; }

  const db = window.APP.db;
  const product = {
    name,
    type: document.getElementById('pf-type')?.value || 'software',
    price: parseFloat(document.getElementById('pf-price')?.value) || 0,
    cost: parseFloat(document.getElementById('pf-cost')?.value) || 0
  };

  if (editId) {
    const idx = db.products.findIndex(p => p.id === editId);
    if (idx === -1) { showToast('商品不存在', 'error'); return; }
    Object.assign(db.products[idx], product);
    showToast('商品已更新');
  } else {
    product.id = genId();
    product.createdAt = Date.now();
    db.products.push(product);
    showToast('商品已添加');
  }

  saveDB();
  closeModal();
  renderProducts();
}

function showEditProductModal(id) {
  const db = window.APP.db;
  const p = db.products.find(p => p.id === id);
  if (!p) return;
  showAddProductModal({ ...p });
}

function deleteProduct(id) {
  const db = window.APP.db;
  const p = db.products.find(p => p.id === id);
  if (!p) return;
  confirmDialog(`确定删除商品「${p.name}」吗？<br><small style="color:#94a3b8">不影响已创建的订单</small>`, () => {
    db.products = db.products.filter(p => p.id !== id);
    delete (db.productDisplayData || {})[id];
    saveDB();
    showToast('商品已删除');
    renderProducts();
  }, '删除商品');
}

// 编辑客户展示数据
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
  renderProducts();
}
