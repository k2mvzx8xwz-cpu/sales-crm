/**
 * 客户管理.js - 销售客户管理系统 v3.0.0
 * 职责：客户列表、新增/编辑/删除/详情、搜索过滤
 */

// ==================== 事件委托（解决 onclick 在某些环境下不触发的问题）====================
document.addEventListener('click', function(e) {
  var el = e.target.closest('[data-action]');
  if (!el) return;
  var action = el.getAttribute('data-action');
  var id = el.getAttribute('data-id');
  if (action === 'delete-customer') {
    if (id) window.deleteCustomer(id);
  } else if (action === 'edit-customer') {
    if (id) window.showEditCustomerModal(id);
  } else if (action === 'view-customer') {
    if (id) window.showCustomerDetail(id);
  }
});

let customerPage = 1;
let customerFilter = 'all';
let customerKeyword = '';
let customerSelected = [];
function renderCustomers() {
  const el = document.getElementById('page-customers');
  if (!el) return;

  const db = window.APP.db;
  let list = [...(db.customers || [])].sort((a, b) => b.createdAt - a.createdAt);

  // 过滤
  if (customerFilter !== 'all') list = list.filter(c => c.type === customerFilter);
  if (customerKeyword) list = filterList(list, customerKeyword, ['wechatName', 'wechatId', 'phone', 'name']);

  const pager = paginate(list, customerPage, 15);

  el.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">客户管理</h2>
      <div style="display:flex;gap:8px;">
        <button class="btn-danger" onclick="batchDeleteCustomers()" ${customerSelected.length===0?'disabled style="opacity:0.5;cursor:not-allowed;"':''}>批量删除 (${customerSelected.length})</button>
        <button class="btn-primary" onclick="showAddCustomerModal()">+ 新增客户</button>
      </div>
    </div>
    <div class="toolbar">
      <div class="filter-tabs">
        <button class="filter-tab ${customerFilter === 'all' ? 'active' : ''}" onclick="setCustomerFilter('all')">全部 (${(db.customers||[]).length})</button>
        <button class="filter-tab ${customerFilter === 'software' ? 'active' : ''}" onclick="setCustomerFilter('software')">软件 (${(db.customers||[]).filter(c=>c.type==='software').length})</button>
        <button class="filter-tab ${customerFilter === 'hardware' ? 'active' : ''}" onclick="setCustomerFilter('hardware')">硬件 (${(db.customers||[]).filter(c=>c.type==='hardware').length})</button>
      </div>
      <div class="search-box">
        <input type="text" id="customer-search" placeholder="搜索微信名/微信号/手机号..." value="${customerKeyword}"
          oninput="customerKeyword=this.value;customerPage=1;renderCustomers()">
      </div>
    </div>
    <div class="section-card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th style="width:40px;"><input type="checkbox" onchange="toggleCustomerSelectAll(this)" ${pager.items.length===0?'disabled':''}></th>
            <th>序号</th><th>微信昵称</th><th>微信号</th><th>手机号</th>
            <th>类型</th><th>购买次数</th><th>累计金额</th><th>客户来源</th><th>添加时间</th><th>操作</th>
          </tr></thead>
          <tbody>
            ${pager.items.length === 0 ? `<tr><td colspan="11" class="empty-cell">暂无客户数据</td></tr>` :
              pager.items.map((c, idx) => {
                const swOrders = db.orders.filter(o => o.customerId === c.id && o.type === 'software');
                const hwOrders = db.orders.filter(o => o.customerId === c.id && o.type === 'hardware');
                const totalAmt = db.orders.filter(o => o.customerId === c.id && !o.isOldCustomer)
                  .reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
                const isChecked = customerSelected.includes(c.id);
                return `<tr>
                  <td><input type="checkbox" class="cust-cb" value="${c.id}" ${isChecked?'checked':''} onchange="onCustomerCheckChange('${c.id}', this.checked)"></td>
                  <td>${(customerPage-1)*15+idx+1}</td>
                  <td><a href="#" class="link" onclick="showCustomerDetail('${c.id}')">${c.wechatName || '-'}</a></td>
                  <td>
                    <span>${c.wechatId || '-'}</span>
                    ${c.wechatId ? `<button class="btn-copy-inline" onclick="copyToClipboard('${c.wechatId}','微信号已复制')" title="复制微信号">⎘</button>` : ''}
                  </td>
                  <td>${c.phone || '-'}</td>
                  <td><span class="badge ${c.type === 'software' ? 'badge-blue' : 'badge-green'}">${c.type === 'software' ? '软件' : '硬件'}</span></td>
                  <td>软件${swOrders.length}次 / 硬件${hwOrders.length}次</td>
                  <td>¥${formatMoney(totalAmt)}</td>
                  <td>${c.source || '-'}</td>
                  <td style="font-size:12px;">${c.addedTime || formatDate(new Date(c.createdAt), 'YYYY-MM-DD HH:mm:ss')}</td>
                  <td class="action-cell">
                    <button class="btn-xs btn-primary" data-action="view-customer" data-id="${c.id}">查看</button>
                    <button class="btn-xs btn-secondary" data-action="edit-customer" data-id="${c.id}">编辑</button>
                    <button class="btn-xs btn-danger" data-action="delete-customer" data-id="${c.id}">删除</button>
                  </td>
                </tr>`;
              }).join('')}
          </tbody>
        </table>
      </div>
      <div id="customer-pager"></div>
    </div>
  `;
  renderPager('customer-pager', pager, (p) => { customerPage = p; renderCustomers(); });
}

function setCustomerFilter(f) {
  customerFilter = f;
  customerPage = 1;
  renderCustomers();
}

// ==================== 新增客户弹窗 ====================
function showAddCustomerModal(prefill = {}, onCreated = null) {
  const db = window.APP.db;
  const sources = (db.settings.customerSources || []).map(s =>
    `<option value="${s}" ${prefill.source === s ? 'selected' : ''}>${s}</option>`
  ).join('');

  const content = `
    <form id="customer-form">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label required">微信昵称</label>
          <input type="text" class="form-input" id="cf-wechatName" value="${prefill.wechatName||''}" placeholder="请输入微信昵称" required>
        </div>
        <div class="form-group">
          <label class="form-label">微信号</label>
          <input type="text" class="form-input" id="cf-wechatId" value="${prefill.wechatId||''}" placeholder="请输入微信号">
        </div>
        <div class="form-group">
          <label class="form-label">手机号</label>
          <input type="text" class="form-input" id="cf-phone" value="${prefill.phone||''}" placeholder="请输入手机号">
        </div>
        <div class="form-group">
          <label class="form-label required">客户类型</label>
          <select class="form-select" id="cf-type" onchange="toggleCustomerTypeFields()">
            <option value="software" ${(prefill.type||'software')==='software'?'selected':''}>软件客户</option>
            <option value="hardware" ${prefill.type==='hardware'?'selected':''}>硬件客户</option>
          </select>
        </div>
        <div class="form-group" id="cf-cardCatGroup">
          <label class="form-label">卡密分类</label>
          <select class="form-select" id="cf-cardCategory">
            <option value="">请选择</option>
            <option value="temp" ${prefill.cardCategory==='temp'?'selected':''}>临时卡</option>
            <option value="monthly" ${prefill.cardCategory==='monthly'?'selected':''}>月卡</option>
            <option value="quarterly" ${prefill.cardCategory==='quarterly'?'selected':''}>季卡</option>
            <option value="halfyear" ${prefill.cardCategory==='halfyear'?'selected':''}>半年卡</option>
            <option value="yearly" ${prefill.cardCategory==='yearly'?'selected':''}>年卡</option>
            <option value="permanent" ${prefill.cardCategory==='permanent'?'selected':''}>永久卡</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">客户来源</label>
          <select class="form-select" id="cf-source">
            <option value="">请选择</option>
            ${sources}
          </select>
        </div>
        <div class="form-group form-full" id="cf-hwGroup">
          <div class="form-section-title">收货信息（硬件客户专用）</div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">收件人姓名</label>
              <input type="text" class="form-input" id="cf-receiver" value="${prefill.receiver||''}" placeholder="收件人姓名">
            </div>
            <div class="form-group">
              <label class="form-label">收货手机号</label>
              <input type="text" class="form-input" id="cf-receiverPhone" value="${prefill.receiverPhone||''}" placeholder="收货手机号">
            </div>
            <div class="form-group form-full">
              <label class="form-label">收货地址</label>
              <input type="text" class="form-input" id="cf-address" value="${prefill.address||''}" placeholder="详细收货地址">
            </div>
            <div class="form-group">
              <label class="form-label">搭配产品</label>
              <input type="text" class="form-input" id="cf-matchProduct" value="${prefill.matchProduct||''}" placeholder="搭配使用的软件产品">
            </div>
          </div>
        </div>
        <div class="form-group form-full">
          <label class="form-label">备注</label>
          <textarea class="form-textarea" id="cf-note" placeholder="备注信息">${prefill.note||''}</textarea>
        </div>
      </div>
    </form>
  `;

  const isEdit = !!prefill.id;
  showModal(isEdit ? '编辑客户' : '新增客户', content,
    `<button onclick="closeModal()" class="btn-secondary">取消</button>
     <button onclick="saveCustomer(${isEdit ? `'${prefill.id}'` : 'null'}, ${onCreated ? onCreated.toString() : 'null'})" class="btn-primary">${isEdit ? '保存修改' : '保存客户'}</button>`, 'lg');

  setTimeout(() => toggleCustomerTypeFields(), 50);
}

function toggleCustomerTypeFields() {
  const type = document.getElementById('cf-type')?.value;
  const hwGroup = document.getElementById('cf-hwGroup');
  const ccGroup = document.getElementById('cf-cardCatGroup');
  if (hwGroup) hwGroup.style.display = type === 'hardware' ? 'block' : 'none';
  if (ccGroup) ccGroup.style.display = type === 'software' ? 'block' : 'none';
}

function saveCustomer(editId = null, onCreated = null) {
  const wechatName = document.getElementById('cf-wechatName')?.value?.trim();
  if (!wechatName) { showToast('微信昵称不能为空', 'error'); return; }

  const db = window.APP.db;

  if (editId) {
    const idx = db.customers.findIndex(c => c.id === editId);
    if (idx === -1) { showToast('客户不存在', 'error'); return; }

    const customer = {
      wechatName,
      wechatId: document.getElementById('cf-wechatId')?.value?.trim() || '',
      phone: document.getElementById('cf-phone')?.value?.trim() || '',
      type: document.getElementById('cf-type')?.value || 'software',
      cardCategory: document.getElementById('cf-cardCategory')?.value || '',
      source: document.getElementById('cf-source')?.value || '',
      receiver: document.getElementById('cf-receiver')?.value?.trim() || '',
      receiverPhone: document.getElementById('cf-receiverPhone')?.value?.trim() || '',
      address: document.getElementById('cf-address')?.value?.trim() || '',
      matchProduct: document.getElementById('cf-matchProduct')?.value?.trim() || '',
      note: document.getElementById('cf-note')?.value?.trim() || ''
    };

    Object.assign(db.customers[idx], customer);
    // 同步更新关联订单
    db.orders.forEach(o => {
      if (o.customerId === editId) {
        o.customerName = customer.wechatName;
        o.wechatName = customer.wechatName;
        o.wechatId = customer.wechatId;
      }
    });
    saveDB();
    closeModal();
    showToast('客户信息已更新');
    renderCustomers();
  } else {
    const customer = {
      id: genId(),
      name: wechatName,
      wechatName,
      wechatId: document.getElementById('cf-wechatId')?.value?.trim() || '',
      phone: document.getElementById('cf-phone')?.value?.trim() || '',
      type: document.getElementById('cf-type')?.value || 'software',
      cardCategory: document.getElementById('cf-cardCategory')?.value || '',
      source: document.getElementById('cf-source')?.value || '',
      receiver: document.getElementById('cf-receiver')?.value?.trim() || '',
      receiverPhone: document.getElementById('cf-receiverPhone')?.value?.trim() || '',
      address: document.getElementById('cf-address')?.value?.trim() || '',
      matchProduct: document.getElementById('cf-matchProduct')?.value?.trim() || '',
      note: document.getElementById('cf-note')?.value?.trim() || '',
      addedTime: getFullDatetime(),  // 添加时间（年月日时分秒）
      createdAt: Date.now(),
      _lastModified: Date.now() // 添加时间戳用于合并
    };
    db.customers.push(customer);
    saveDB();
    closeModal();
    showToast('客户添加成功');
    if (typeof onCreated === 'function') onCreated(customer);
    else renderCustomers();
  }
}

function showEditCustomerModal(id) {
  const db = window.APP.db;
  const c = db.customers.find(c => c.id === id);
  if (!c) return;
  showAddCustomerModal({ ...c });
}

function deleteCustomer(id) {
  const db = window.APP.db;
  const c = db.customers.find(c => c.id === id);
  if (!c) { showToast('客户不存在', 'error'); return; }
  confirmDialog('确定删除客户「' + c.wechatName + '」吗？\n\n关联订单不会被删除', function() {
    db.customers = db.customers.filter(function(x) { return x.id !== id; });
    saveDB();
    showToast('客户已删除', 'success');
    renderCustomers();
  });
}

// ==================== 客户详情弹窗 ====================
function showCustomerDetail(id) {
  const db = window.APP.db;
  const c = db.customers.find(c => c.id === id);
  if (!c) return;

  const swOrders = db.orders.filter(o => o.customerId === id && o.type === 'software');
  const hwOrders = db.orders.filter(o => o.customerId === id && o.type === 'hardware');
  const totalAmt = db.orders.filter(o => o.customerId === id && !o.isOldCustomer)
    .reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const allOrders = [...db.orders.filter(o => o.customerId === id)].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);

  // 换卡记录
  const cardRecords = (db.cardRecords || []).filter(r => r.customerId === id).sort((a, b) => b.createdAt - a.createdAt);

  const content = `
    <div class="detail-section">
      <div class="detail-title">基础信息</div>
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-key">微信昵称</span><span class="detail-val">${c.wechatName || '-'}</span></div>
        <div class="detail-item">
          <span class="detail-key">微信号</span>
          <span class="detail-val">${c.wechatId || '-'}
            ${c.wechatId ? `<button class="btn-copy-inline" onclick="copyToClipboard('${c.wechatId}','微信号已复制')">⎘</button>` : ''}
          </span>
        </div>
        <div class="detail-item"><span class="detail-key">手机号</span><span class="detail-val">${c.phone || '-'}</span></div>
        <div class="detail-item"><span class="detail-key">客户类型</span><span class="detail-val">${c.type === 'software' ? '软件客户' : '硬件客户'}</span></div>
        <div class="detail-item"><span class="detail-key">卡密分类</span><span class="detail-val">${getCardCategoryLabel(c.cardCategory) || '-'}</span></div>
        <div class="detail-item"><span class="detail-key">客户来源</span><span class="detail-val">${c.source || '-'}</span></div>
        <div class="detail-item"><span class="detail-key">备注</span><span class="detail-val">${c.note || '-'}</span></div>
        <div class="detail-item"><span class="detail-key">添加时间</span><span class="detail-val">${c.addedTime || formatDate(new Date(c.createdAt), 'YYYY-MM-DD HH:mm:ss')}</span></div>
      </div>
    </div>

    ${c.type === 'hardware' ? `
    <div class="detail-section">
      <div class="detail-title">收货信息</div>
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-key">收件人</span><span class="detail-val">${c.receiver || '-'}</span></div>
        <div class="detail-item"><span class="detail-key">收货手机</span><span class="detail-val">${c.receiverPhone || '-'}</span></div>
        <div class="detail-item form-full"><span class="detail-key">收货地址</span><span class="detail-val">${c.address || '-'}</span></div>
        <div class="detail-item"><span class="detail-key">搭配产品</span><span class="detail-val">${c.matchProduct || '-'}</span></div>
      </div>
      ${c.receiver ? `<button class="btn-secondary" style="margin-top:10px" onclick="copyToClipboard('收件人：${c.receiver}，手机号：${c.receiverPhone}，地址：${c.address}','收货信息已复制')">📋 复制收货信息</button>` : ''}
    </div>` : ''}

    <div class="detail-section">
      <div class="detail-title">消费统计</div>
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-key">软件订单</span><span class="detail-val">${swOrders.length} 笔</span></div>
        <div class="detail-item"><span class="detail-key">硬件订单</span><span class="detail-val">${hwOrders.length} 笔</span></div>
        <div class="detail-item"><span class="detail-key">累计消费</span><span class="detail-val">¥${formatMoney(totalAmt)}</span></div>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-title">历史订单（最近10条）</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>序号</th><th>订单号</th><th>类型</th><th>产品</th><th>金额</th><th>购买日期</th><th>操作</th></tr></thead>
          <tbody>
            ${allOrders.length === 0 ? '<tr><td colspan="7" class="empty-cell">暂无订单</td></tr>' :
              allOrders.map((o, idx) => `<tr>
                <td>${idx+1}</td>
                <td><span class="mono">${o.orderNo||'-'}</span></td>
                <td><span class="badge ${o.type==='software'?'badge-blue':'badge-green'}">${o.type==='software'?'软件':'硬件'}</span></td>
                <td style="white-space:normal;word-break:break-all;max-width:160px;">${o.productName||'-'}</td>
                <td>¥${formatMoney(o.totalAmount)}</td>
                <td style="font-size:12px;">${formatDate(new Date(o.orderDate||o.createdAt),'YYYY-MM-DD HH:mm:ss')}</td>
                <td><button class="btn-xs btn-primary" onclick="closeModal();showOrderDetail('${o.id}')">详情</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    ${cardRecords.length > 0 ? `
    <div class="detail-section">
      <div class="detail-title">购卡/换卡记录</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>序号</th><th>类型</th><th>卡密</th><th>旧卡密</th><th>分类</th><th>有效期</th><th>操作日期</th></tr></thead>
          <tbody>
            ${cardRecords.map((r, idx) => `<tr>
              <td>${idx+1}</td>
              <td><span class="badge ${r.opType==='buy'?'badge-blue':'badge-warning'}">${r.opType==='buy'?'购买':'换卡'}</span></td>
              <td>
                <span class="mono card-text">${r.cardCode||'-'}</span>
                ${r.cardCode ? `<button class="btn-copy-inline" onclick="copyToClipboard('${r.cardCode}','卡密已复制')">⎘</button>` : ''}
              </td>
              <td>
                <span class="mono card-text">${r.oldCardCode||'-'}</span>
                ${r.oldCardCode ? `<button class="btn-copy-inline" onclick="copyToClipboard('${r.oldCardCode}','旧卡密已复制')">⎘</button>` : ''}
              </td>
              <td>${getCardCategoryLabel(r.category)}</td>
              <td>${r.expireDate||'-'}</td>
              <td>${r.opDate||'-'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}
  `;

  showModal(`客户详情 - ${c.wechatName}`, content,
    `<button onclick="closeModal()" class="btn-secondary">关闭</button>
     <button onclick="closeModal();showEditCustomerModal('${id}')" class="btn-primary">编辑客户</button>`, 'xl');
}

// ==================== 批量操作 ====================
function onCustomerCheckChange(id, checked) {
  if (checked) { if (!customerSelected.includes(id)) customerSelected.push(id); }
  else { customerSelected = customerSelected.filter(x => x !== id); }
  refreshBatchCustomerBtn();
}

function toggleCustomerSelectAll(master) {
  if (master.checked) {
    const db = window.APP.db;
    let list = [...(db.customers||[])].sort((a,b)=>b.createdAt-a.createdAt);
    if (customerFilter !== 'all') list = list.filter(c=>c.type===customerFilter);
    if (customerKeyword) list = filterList(list, customerKeyword, ['wechatName','wechatId','phone','name']);
    customerSelected = list.map(c=>c.id);
  } else { customerSelected = []; }
  document.querySelectorAll('.cust-cb').forEach(cb=>{ cb.checked = master.checked; });
  refreshBatchCustomerBtn();
}

function refreshBatchCustomerBtn() {
  const btns = document.querySelectorAll('#page-customers .page-header [onclick]');
  btns.forEach(btn=>{
    if (btn.textContent.includes('批量删除')) {
      btn.disabled = customerSelected.length===0;
      btn.style.opacity = customerSelected.length===0?'0.5':'1';
      btn.textContent = `批量删除 (${customerSelected.length})`;
    }
  });
}

function batchDeleteCustomers() {
  if (customerSelected.length===0){showToast('请先选择客户','error');return;}
  confirmDialog(`确定批量删除选中的 <b>${customerSelected.length}</b> 个客户吗？<br><small style="color:#94a3b8">关联订单不会被删除</small>`,function(){
    const db=window.APP.db;
    db.customers = db.customers.filter(c=>!customerSelected.includes(c.id));
    saveDB();
    customerSelected=[];
    showToast('批量删除完成');
    renderCustomers();
  },'批量删除客户');
}