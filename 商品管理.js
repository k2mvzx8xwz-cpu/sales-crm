/**
 * 商品管理.js - 销售客户管理系统
 * 职责：商品列表（真实数据页）、新增/编辑/删除
 */

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
    <div class="section-card">
      <div class="section-card-header"><span>商品列表（用于订单选择和成本利润计算）</span></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>序号</th><th>商品名称</th><th>类型</th><th>备注</th><th>售价(¥)</th><th>成本(¥)</th><th>利润(¥)</th><th>操作</th></tr></thead>
          <tbody>
            ${products.length === 0 ? `<tr><td colspan="8" class="empty-cell">暂无商品，点击上方"新增商品"添加</td></tr>` :
              products.map((p, idx) => `<tr>
                <td>${idx+1}</td>
                <td style="white-space:normal;word-break:break-all;min-width:120px;max-width:200px;" title="${p.name}">${p.name}</td>
                <td><span class="badge ${p.type==='software'?'badge-blue':'badge-green'}">${p.type==='software'?'软件':'硬件'}</span></td>
                <td style="white-space:normal;word-break:break-all;max-width:180px;font-size:12px;color:#94a3b8">${p.note||'-'}</td>
                <td>${formatMoney(p.price)}</td>
                <td>${formatMoney(p.cost)}</td>
                <td class="text-success">${formatMoney((p.price||0)-(p.cost||0))}</td>
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
        <div class="form-group form-full">
          <label class="form-label">备注</label>
          <input type="text" class="form-input" id="pf-note" value="${prefill.note||''}" placeholder="可选：补充商品说明（如：安卓系统、顺丰包邮等）">
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
    cost: parseFloat(document.getElementById('pf-cost')?.value) || 0,
    note: document.getElementById('pf-note')?.value?.trim() || ''
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
    saveDB();
    showToast('商品已删除');
    renderProducts();
  }, '删除商品');
}
