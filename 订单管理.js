/**
 * 订单管理.js - 销售客户管理系统 v3.3.0
 * 职责：订单列表、新增/编辑/删除/详情、软件+硬件订单
 * 调整：1.软件列表卡密+剩余时长独立列（不在产品名下）2.购买日期精确到时分秒
 *       3.微信号列移出订单列表（腾空间给卡密列）4.所有列表页显示序号
 *       5.工作台统计卡片点击跳转明细 6.商品客户展示页显示商品类型
 *       7.数据统计明细表格显示序号 8.订单类型切换字段完全同步
 */

let orderPage = 1;
let orderFilter = 'all';
let orderKeyword = '';

function renderOrders() {
  const el = document.getElementById('page-orders');
  if (!el) return;

  const db = window.APP.db;
  let list = [...(db.orders || [])].sort((a, b) => b.createdAt - a.createdAt);

  if (orderFilter !== 'all') list = list.filter(o => o.type === orderFilter);
  if (orderKeyword) list = filterList(list, orderKeyword, ['orderNo', 'wechatName', 'customerName', 'productName', 'wechatId']);

  const pager = paginate(list, orderPage, 15);

  el.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">订单管理</h2>
      <div style="display:flex;gap:10px;">
        <button class="btn-primary" onclick="showAddOrderModal('software')">+ 新增软件订单</button>
        <button class="btn-success" onclick="showAddOrderModal('hardware')">+ 新增硬件订单</button>
      </div>
    </div>
    <div class="toolbar">
      <div class="filter-tabs">
        <button class="filter-tab ${orderFilter==='all'?'active':''}" onclick="setOrderFilter('all')">全部 (${db.orders.length})</button>
        <button class="filter-tab ${orderFilter==='software'?'active':''}" onclick="setOrderFilter('software')">软件 (${db.orders.filter(o=>o.type==='software').length})</button>
        <button class="filter-tab ${orderFilter==='hardware'?'active':''}" onclick="setOrderFilter('hardware')">硬件 (${db.orders.filter(o=>o.type==='hardware').length})</button>
      </div>
      <div class="search-box">
        <input type="text" placeholder="搜索客户/产品..." value="${orderKeyword}"
          oninput="orderKeyword=this.value;orderPage=1;renderOrders()">
      </div>
    </div>
    <div class="section-card">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>微信昵称</th>
              <th>产品名称</th>
              <!-- 软件列 -->
              <th class="sw-col">卡密</th>
              <!-- 硬件列 -->
              <th class="hw-col" style="display:none">接口类型</th>
              <th>金额</th>
              <th>数量</th>
              <!-- 软件列 -->
              <th class="sw-col">分类</th>
              <!-- 硬件列 -->
              <th class="hw-col" style="display:none">快递公司</th>
              <th>购买日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${pager.items.length === 0 ? `<tr><td colspan="10" class="empty-cell">暂无订单数据</td></tr>` :
              pager.items.map((o, idx) => {
                const pName = o.productName || '-';
                // 软件订单：卡密+剩余时长（并排显示在同一单元格内）
                const cardCell = o.type === 'software' && o.cardCode
                  ? `<div style="display:flex;flex-direction:column;gap:2px;">
                       <span class="mono card-clickcopy" style="color:#7dd3fc;cursor:pointer;font-size:12px;" title="点击复制卡密" onclick="copyToClipboard('${o.cardCode.replace(/'/g,"\\'")}','卡密已复制')">${o.cardCode}</span>
                       ${o.expireDate ? `<span style="font-size:11px;">${formatRemainingTime(o.expireDate)}</span>` : ''}
                     </div>`
                  : '-';
                // 软件订单：分类标签；硬件订单：快递公司
                const extraCol = o.type === 'hardware'
                  ? (o.expressCompany || '-')
                  : (o.cardCategory ? `<span class="badge badge-gray" style="font-size:11px">${getCardCategoryLabel(o.cardCategory)}</span>` : '-');
                // 购买日期精确到时分秒
                const dateStr = formatDate(new Date(o.orderDate||o.createdAt),'YYYY-MM-DD HH:mm:ss');
                const rowClass = o.type === 'hardware' ? 'hw-order-row' : 'sw-order-row';
                return `<tr class="${rowClass}">
                  <td>${(orderPage-1)*15+idx+1}</td>
                  <td>${o.wechatName||'-'}</td>
                  <td style="white-space:normal;word-break:break-all;min-width:160px;max-width:220px;">${pName}</td>
                  <td class="sw-col" style="white-space:nowrap;">${cardCell}</td>
                  <td class="hw-col" style="display:none">${o.portType ? `<span class="badge badge-gray">${o.portType}口</span>` : '-'}</td>
                  <td>¥${formatMoney(o.totalAmount)}</td>
                  <td>${o.qty||1}</td>
                  <td class="sw-col">${extraCol}</td>
                  <td class="hw-col" style="display:none">${extraCol}</td>
                  <td style="white-space:nowrap;font-size:12px;">${dateStr}</td>
                  <td class="action-cell">
                    <button class="btn-xs btn-primary" onclick="showOrderDetail('${o.id}')">详情</button>
                    <button class="btn-xs btn-secondary" onclick="showEditOrderModal('${o.id}')">编辑</button>
                    <button class="btn-xs btn-info" onclick="copyOrderByTemplate('${o.id}')" title="复制订单信息">⎘</button>
                    <button class="btn-xs btn-danger" onclick="deleteOrder('${o.id}')">删除</button>
                  </td>
                </tr>`;
              }).join('')}
          </tbody>
        </table>
      </div>
      <div id="order-pager"></div>
    </div>
  `;
  renderPager('order-pager', pager, (p) => { orderPage = p; renderOrders(); });
}

function setOrderFilter(f) {
  orderFilter = f;
  orderPage = 1;
  renderOrders();
  // 动态切换表格列显示（软件列 vs 硬件列）
  setTimeout(() => {
    const table = document.querySelector('#page-orders .data-table');
    if (table) {
      table.classList.toggle('filter-software', f === 'software');
    }
  }, 0);
}

// ==================== 新增/编辑订单弹窗 ====================
function showAddOrderModal(defaultType = 'software', prefill = {}) {
  const db = window.APP.db;
  const customers = db.customers || [];
  // 调整6：硬件订单只显示硬件商品
  const swProducts = (db.products || []).filter(p => p.type === 'software');
  const hwProducts = (db.products || []).filter(p => p.type === 'hardware');
  const isEdit = !!prefill.id;
  const type = prefill.type || defaultType;

  // 调整3：购买日期自动填入当前时间
  const nowStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  })();
  const orderDateVal = prefill.orderDate
    ? formatDate(new Date(prefill.orderDate), 'YYYY-MM-DDThh:mm').replace('hh:mm', new Date(prefill.orderDate).toTimeString().slice(0,5))
    : nowStr;

  // 调整2：客户选择用自定义模糊搜索
  const customerListJson = JSON.stringify(customers.map(c => ({
    id: c.id, label: `${c.wechatName}${c.wechatId?' ('+c.wechatId+')':''}${c.phone?' '+c.phone:''}`,
    name: c.wechatName, wechatId: c.wechatId||''
  }))).replace(/"/g, '&quot;');

  const selectedCustomer = prefill.customerId ? customers.find(c => c.id === prefill.customerId) : null;
  const selectedCustomerLabel = selectedCustomer
    ? `${selectedCustomer.wechatName}${selectedCustomer.wechatId?' ('+selectedCustomer.wechatId+')':''}`
    : '';

  const content = `
    <form id="order-form">
      <!-- 订单类型 -->
      <div class="form-group form-full">
        <label class="form-label required">订单类型</label>
        <div class="radio-group">
          <label class="radio-item ${type==='software'?'active':''}">
            <input type="radio" name="of-type" value="software" ${type==='software'?'checked':''} onchange="onOrderTypeChange('software')"> 软件订单
          </label>
          <label class="radio-item ${type==='hardware'?'active':''}">
            <input type="radio" name="of-type" value="hardware" ${type==='hardware'?'checked':''} onchange="onOrderTypeChange('hardware')"> 硬件订单
          </label>
        </div>
      </div>

      <!-- 调整2：客户自定义模糊搜索下拉 -->
      <div class="form-group">
        <label class="form-label required">关联客户</label>
        <div style="display:flex;gap:8px;">
          <div style="position:relative;flex:1;">
            <input type="text" class="form-input" id="of-customerSearch"
              placeholder="输入微信名/微信号/手机号搜索..."
              value="${selectedCustomerLabel}"
              oninput="searchCustomerDropdown(this.value)"
              onclick="searchCustomerDropdown(this.value)"
              autocomplete="off">
            <div id="customer-dropdown" class="custom-dropdown" style="display:none;"></div>
          </div>
          <button type="button" class="btn-secondary" onclick="showCustomerPicker()" title="从现有客户中选择">浏览...</button>
          <input type="hidden" id="of-customerId" value="${prefill.customerId||''}">
          <button type="button" class="btn-secondary" onclick="showQuickAddCustomer()" title="快速新增客户">+ 新客户</button>
        </div>
      </div>

      <!-- 调整6：商品选择（硬件订单仅显示硬件商品） -->
      <div class="form-group">
        <label class="form-label required">关联商品</label>
        <select class="form-select" id="of-productId" onchange="onProductChange()">
          <option value="">请选择商品</option>
          <optgroup label="软件产品" id="sw-products-group">
            ${swProducts.map(p=>`<option value="${p.id}" data-price="${p.price}" data-cost="${p.cost}" data-type="software" ${prefill.productId===p.id?'selected':''}>${p.name} (¥${p.price})</option>`).join('')}
          </optgroup>
          <optgroup label="硬件产品" id="hw-products-group">
            ${hwProducts.map(p=>`<option value="${p.id}" data-price="${p.price}" data-cost="${p.cost}" data-type="hardware" ${prefill.productId===p.id?'selected':''}>${p.name} (¥${p.price})</option>`).join('')}
          </optgroup>
        </select>
      </div>

      <!-- 数量/单价/金额/折扣 -->
      <div class="form-group">
        <label class="form-label">数量</label>
        <input type="number" class="form-input" id="of-qty" min="1" value="${prefill.qty||1}" oninput="calcOrderAmount()">
      </div>
      <div class="form-group">
        <label class="form-label">单价 (¥)</label>
        <input type="number" class="form-input" id="of-price" step="0.01" value="${prefill.price||''}" oninput="calcOrderAmount()">
      </div>
      <div class="form-group">
        <label class="form-label">总金额 (¥)</label>
        <input type="number" class="form-input" id="of-amount" step="0.01" value="${prefill.totalAmount||''}">
      </div>
      <div class="form-group">
        <label class="form-label">折扣</label>
        <input type="number" class="form-input" id="of-discount" step="0.01" min="0" max="1" placeholder="如0.85表示85折" value="${prefill.discount||''}" oninput="calcOrderAmount()">
      </div>

      <!-- 老客户标记 -->
      <div class="form-group form-full">
        <label class="checkbox-item">
          <input type="checkbox" id="of-isOld" ${prefill.isOldCustomer?'checked':''} onchange="onOldCustomerToggle()">
          <span>老客户/永久卡（勾选后金额、成本、利润清零，不计入销售统计）</span>
        </label>
      </div>

      <!-- 调整3：购买日期自动填入当前时间，支持手动调整 -->
      <div class="form-group">
        <label class="form-label required">购买日期</label>
        <input type="datetime-local" class="form-input" id="of-orderDate" value="${orderDateVal}">
      </div>

      <!-- ========== 软件订单专属字段 ========== -->
      <div id="sw-fields" style="display:${type==='software'?'contents':'none'}">
        <!-- 调整5：卡密选择优化 —— 点击直接显示所有卡密，支持分类筛选，支持输入新卡密 -->
        <div class="form-group form-full sw-field">
          <label class="form-label">卡密选择</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <select class="form-select" id="of-cardCatFilter" style="width:110px" onchange="showAllCardDropdown()">
              <option value="">全部分类</option>
              <option value="temp">临时卡</option>
              <option value="monthly">月卡</option>
              <option value="quarterly">季卡</option>
              <option value="halfyear">半年卡</option>
              <option value="yearly">年卡</option>
              <option value="permanent">永久卡</option>
            </select>
            <div style="position:relative;flex:1;min-width:200px;">
              <input type="text" class="form-input" id="of-cardSearch"
                placeholder="点击下拉或输入搜索，也可直接输入新卡密..."
                oninput="searchCardDropdown(this.value)"
                onclick="showAllCardDropdown()"
                autocomplete="off">
              <div id="card-dropdown" class="custom-dropdown" style="display:none;"></div>
            </div>
          </div>
          <input type="hidden" id="of-cardId" value="${prefill.cardId||''}">
          <div id="selected-card-display" style="margin-top:8px;display:${prefill.cardCode?'flex':'none'};align-items:center;gap:8px;padding:8px;background:#0f172a;border-radius:6px;">
            <span style="color:#94a3b8;font-size:12px">已选卡密：</span>
            <span id="selected-card-text" class="mono card-clickcopy" style="color:#7dd3fc;cursor:pointer;" title="点击复制" onclick="copyToClipboard(this.textContent,'卡密已复制')">${prefill.cardCode||''}</span>
            <button type="button" class="btn-copy-inline" onclick="copyToClipboard(document.getElementById('selected-card-text').textContent,'卡密已复制')">⎘</button>
            <button type="button" class="btn-xs btn-danger" onclick="clearSelectedCard()" style="margin-left:auto">取消选择</button>
          </div>
          <div style="margin-top:6px;font-size:12px;color:#94a3b8;">
            💡 若卡密不在库中，可直接输入后点击「<span style="color:#7dd3fc;cursor:pointer;" onclick="confirmNewCard()">确认添加新卡密</span>」自动入库
          </div>
        </div>

        <div class="form-group sw-field">
          <label class="form-label">卡密分类</label>
          <select class="form-select" id="of-cardCategory" onchange="onCardCategoryChange()">
            <option value="">请选择</option>
            <option value="temp" ${prefill.cardCategory==='temp'?'selected':''}>临时卡</option>
            <option value="monthly" ${prefill.cardCategory==='monthly'?'selected':''}>月卡</option>
            <option value="quarterly" ${prefill.cardCategory==='quarterly'?'selected':''}>季卡</option>
            <option value="halfyear" ${prefill.cardCategory==='halfyear'?'selected':''}>半年卡</option>
            <option value="yearly" ${prefill.cardCategory==='yearly'?'selected':''}>年卡</option>
            <option value="permanent" ${prefill.cardCategory==='permanent'?'selected':''}>永久卡</option>
          </select>
        </div>
        <div class="form-group sw-field">
          <label class="form-label">有效期至</label>
          <input type="date" class="form-input" id="of-expireDate" value="${prefill.expireDate||''}">
        </div>
        <div class="form-group sw-field">
          <label class="form-label">手机品牌</label>
          <select class="form-select" id="of-swPhoneBrand">
            <option value="">请选择</option>
            ${PHONE_BRANDS.map(b=>`<option value="${b}" ${prefill.phoneBrand===b?'selected':''}>${b}</option>`).join('')}
          </select>
        </div>
        <div class="form-group sw-field">
          <label class="form-label">手机型号</label>
          <input type="text" class="form-input" id="of-swPhoneModel" value="${prefill.phoneModel||''}" placeholder="手机型号">
        </div>
        <div class="form-group sw-field">
          <label class="form-label">序列号</label>
          <input type="text" class="form-input" id="of-serialNo" value="${prefill.serialNo||''}" placeholder="设备序列号">
        </div>
      </div>

      <!-- ========== 硬件订单专属字段 ========== -->
      <div id="hw-fields" style="display:${type==='hardware'?'contents':'none'}">
        <div class="form-group hw-field">
          <label class="form-label">插口类型</label>
          <div class="quick-btns">
            <button type="button" class="quick-btn ${prefill.portType==='C'?'active':''}" onclick="setPortType('C')">C口(USB-C)</button>
            <button type="button" class="quick-btn ${prefill.portType==='L'?'active':''}" onclick="setPortType('L')">L口(Lightning)</button>
            <button type="button" class="quick-btn ${prefill.portType==='CL'?'active':''}" onclick="setPortType('CL')">CL双口</button>
            <button type="button" class="quick-btn ${prefill.portType==='BT'?'active':''}" onclick="setPortType('BT')">蓝牙接口</button>
          </div>
          <input type="hidden" id="of-portType" value="${prefill.portType||''}">
        </div>
        <div class="form-group hw-field">
          <label class="form-label">手机品牌</label>
          <select class="form-select" id="of-hwPhoneBrand">
            <option value="">请选择</option>
            ${PHONE_BRANDS.map(b=>`<option value="${b}" ${prefill.phoneBrand===b?'selected':''}>${b}</option>`).join('')}
          </select>
        </div>
        <div class="form-group hw-field">
          <label class="form-label">手机型号</label>
          <input type="text" class="form-input" id="of-hwPhoneModel" value="${prefill.phoneModel||''}" placeholder="手机型号" oninput="autoDetectPort(this.value)">
        </div>
        <div class="form-group hw-field form-full">
          <label class="form-label">收件人</label>
          <div style="display:flex;gap:8px;align-items:flex-start;">
            <div style="flex:1" class="form-grid">
              <input type="text" class="form-input" id="of-receiver" value="${prefill.receiver||''}" placeholder="收件人姓名">
              <input type="text" class="form-input" id="of-receiverPhone" value="${prefill.receiverPhone||''}" placeholder="收货手机号">
              <input type="text" class="form-input form-full" id="of-address" value="${prefill.address||''}" placeholder="详细收货地址" style="grid-column:1/-1">
            </div>
            <button type="button" class="btn-secondary" onclick="fillFromCustomerAddress()" style="white-space:nowrap;margin-top:0">从客户填入</button>
          </div>
        </div>
        <div class="form-group hw-field">
          <label class="form-label">匹配软件</label>
          <input type="text" class="form-input" id="of-matchSoftware" value="${prefill.matchSoftware||''}" placeholder="搭配使用的软件">
        </div>
        <div class="form-group hw-field">
          <label class="form-label">快递公司</label>
          <select class="form-select" id="of-expressCompany">
            <option value="">请选择</option>
            ${EXPRESS_COMPANIES.map(e=>`<option value="${e}" ${prefill.expressCompany===e?'selected':''}>${e}</option>`).join('')}
          </select>
        </div>
        <div class="form-group hw-field">
          <label class="form-label">物流单号</label>
          <input type="text" class="form-input" id="of-trackingNo" value="${prefill.trackingNo||''}" placeholder="物流单号（可后续填写）">
        </div>

        <!-- 蓝牙数据（仅蓝牙打卡商品显示） -->
        <div class="form-group hw-field form-full" id="bt-data-group" style="display:none">
          <div class="form-section-title" style="color:#a78bfa">蓝牙数据信息（仅蓝牙打卡）</div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">蓝牙设备名称</label>
              <input type="text" class="form-input" id="of-btName" value="${prefill.btName||''}" placeholder="蓝牙设备名称">
            </div>
            <div class="form-group">
              <label class="form-label">蓝牙MAC地址</label>
              <input type="text" class="form-input" id="of-btMac" value="${prefill.btMac||''}" placeholder="XX:XX:XX:XX:XX:XX">
            </div>
          </div>
        </div>
      </div>

      <!-- 备注 -->
      <div class="form-group form-full">
        <label class="form-label">备注</label>
        <textarea class="form-textarea" id="of-note" placeholder="订单备注">${prefill.note||''}</textarea>
      </div>

      <!-- 调整4：审批状态/意见放在备注下方（页面最下方） -->
      <div class="form-group" style="margin-top:4px">
        <label class="form-label">审批状态</label>
        <select class="form-select" id="of-approvalStatus">
          <option value="" ${!prefill.approvalStatus?'selected':''}>未选择</option>
          <option value="pending" ${prefill.approvalStatus==='pending'?'selected':''}>审批中</option>
          <option value="approved" ${prefill.approvalStatus==='approved'?'selected':''}>已通过</option>
          <option value="rejected" ${prefill.approvalStatus==='rejected'?'selected':''}>已拒绝</option>
        </select>
      </div>
      <div class="form-group" style="margin-top:4px">
        <label class="form-label">审批意见</label>
        <input type="text" class="form-input" id="of-approvalNote" value="${prefill.approvalNote||''}" placeholder="审批意见">
      </div>
    </form>
  `;

  showModal(isEdit ? '编辑订单' : `新增${type==='software'?'软件':'硬件'}订单`, content,
    `<button onclick="closeModal()" class="btn-secondary">取消</button>
     <button onclick="saveOrder(${isEdit?`'${prefill.id}'`:'null'})" class="btn-primary">${isEdit?'保存修改':'保存订单'}</button>`, 'xl');

  setTimeout(() => {
    onOrderTypeChange(type);
    if (prefill.productId) {
      const sel = document.getElementById('of-productId');
      if (sel) { sel.value = prefill.productId; onProductChange(); }
    }
    // 调整6：根据订单类型过滤商品列表
    filterProductsByType(type);
    // 关闭点击外部时收起下拉
    document.addEventListener('click', closeOrderDropdowns, { once: false });
  }, 50);
}

// 关闭订单弹窗内所有下拉
function closeOrderDropdowns(e) {
  if (!e.target.closest('#of-customerSearch') && !e.target.closest('#customer-dropdown')) {
    const dd = document.getElementById('customer-dropdown');
    if (dd) dd.style.display = 'none';
  }
  if (!e.target.closest('#of-cardSearch') && !e.target.closest('#card-dropdown') && !e.target.closest('#of-cardCatFilter')) {
    const dd = document.getElementById('card-dropdown');
    if (dd) dd.style.display = 'none';
  }
}

// 调整6：根据订单类型过滤商品列表
function filterProductsByType(type) {
  const swGroup = document.getElementById('sw-products-group');
  const hwGroup = document.getElementById('hw-products-group');
  if (!swGroup || !hwGroup) return;
  if (type === 'software') {
    swGroup.style.display = '';
    hwGroup.style.display = 'none';
  } else if (type === 'hardware') {
    swGroup.style.display = 'none';
    hwGroup.style.display = '';
  } else {
    swGroup.style.display = '';
    hwGroup.style.display = '';
  }
}

// 切换订单类型
function onOrderTypeChange(type) {
  const swDiv = document.getElementById('sw-fields');
  const hwDiv = document.getElementById('hw-fields');
  if (swDiv) {
    swDiv.querySelectorAll('.sw-field').forEach(el => el.style.display = type==='software'?'':'none');
  }
  if (hwDiv) {
    hwDiv.querySelectorAll('.hw-field').forEach(el => el.style.display = type==='hardware'?'':'none');
  }
  document.querySelectorAll('.radio-item').forEach(el => {
    el.classList.toggle('active', el.querySelector('input')?.value === type);
  });
  // 调整6：切换类型时同步过滤商品
  filterProductsByType(type);
}

// 商品变化时
function onProductChange() {
  const sel = document.getElementById('of-productId');
  if (!sel) return;
  const opt = sel.selectedOptions[0];
  if (!opt || !opt.value) return;

  const price = parseFloat(opt.dataset.price) || 0;
  const pType = opt.dataset.type;

  const priceEl = document.getElementById('of-price');
  if (priceEl) priceEl.value = price;

  // 自动切换订单类型
  if (pType) {
    const radios = document.querySelectorAll('input[name="of-type"]');
    radios.forEach(r => { if (r.value === pType) r.checked = true; });
    onOrderTypeChange(pType);
  }

  // 蓝牙商品判断
  const productName = opt.textContent || '';
  const btGroup = document.getElementById('bt-data-group');
  if (btGroup) btGroup.style.display = productName.includes('蓝牙') ? 'block' : 'none';

  calcOrderAmount();
}

// 计算金额
function calcOrderAmount() {
  const priceEl = document.getElementById('of-price');
  const qtyEl = document.getElementById('of-qty');
  const amountEl = document.getElementById('of-amount');
  const discountEl = document.getElementById('of-discount');
  if (!priceEl || !qtyEl || !amountEl) return;

  const price = parseFloat(priceEl.value) || 0;
  const qty = parseInt(qtyEl.value) || 1;
  const discount = parseFloat(discountEl?.value) || 1;
  const total = price * qty * (discount > 0 && discount <= 1 ? discount : 1);
  amountEl.value = total.toFixed(2);
}

// 老客户切换
function onOldCustomerToggle() {
  const isOld = document.getElementById('of-isOld')?.checked;
  const amountEl = document.getElementById('of-amount');
  if (isOld && amountEl) amountEl.value = '0.00';
}

// 卡密分类变化，自动计算有效期
function onCardCategoryChange() {
  const cat = document.getElementById('of-cardCategory')?.value;
  const orderDateEl = document.getElementById('of-orderDate');
  const expireDateEl = document.getElementById('of-expireDate');
  if (!cat || !orderDateEl || !expireDateEl) return;

  const dateStr = orderDateEl.value ? orderDateEl.value.split('T')[0] : todayStr();
  const expire = calcExpireDate(dateStr, cat);
  if (expire) expireDateEl.value = expire;
}

// 设置插口类型
function setPortType(type) {
  const hidden = document.getElementById('of-portType');
  if (hidden) hidden.value = type;
  document.querySelectorAll('.quick-btns .quick-btn').forEach(btn => btn.classList.remove('active'));
  event?.target?.classList.add('active');
}

// 苹果自动识别插口
function autoDetectPort(model) {
  const port = detectIphonePort(model);
  if (port) {
    const hidden = document.getElementById('of-portType');
    if (hidden) hidden.value = port;
    document.querySelectorAll('.quick-btns .quick-btn').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.includes(port + '口'));
    });
  }
}

// 从客户信息填入收货地址
function fillFromCustomerAddress() {
  const customerId = document.getElementById('of-customerId')?.value;
  if (!customerId) { showToast('请先选择客户', 'warning'); return; }
  const db = window.APP.db;
  const c = db.customers.find(c => c.id === customerId);
  if (!c) return;
  if (document.getElementById('of-receiver')) document.getElementById('of-receiver').value = c.receiver || '';
  if (document.getElementById('of-receiverPhone')) document.getElementById('of-receiverPhone').value = c.receiverPhone || '';
  if (document.getElementById('of-address')) document.getElementById('of-address').value = c.address || '';
  showToast('已从客户信息填入收货地址');
}

// 客户变化（选中后自动填充收货地址）
function onCustomerChange(customerId) {
  if (!customerId) return;
  const db = window.APP.db;
  const c = db.customers.find(c => c.id === customerId);
  if (!c) return;
  if (c.type === 'hardware') fillFromCustomerAddress();
}

// ==================== 客户选择器（任务3） ====================
function showCustomerPicker() {
  const content = `
    <div class="filter-tabs" style="margin-bottom:12px;">
      <button class="filter-tab active" data-type="all" onclick="renderCustomerPickerList(this)">全部</button>
      <button class="filter-tab" data-type="software" onclick="renderCustomerPickerList(this)">软件客户</button>
      <button class="filter-tab" data-type="hardware" onclick="renderCustomerPickerList(this)">硬件客户</button>
    </div>
    <div id="customer-picker-list" style="max-height:380px;overflow-y:auto;"></div>
  `;
  showModal('选择客户', content, `<button onclick="closeModal()" class="btn-secondary">取消</button>`);
  setTimeout(() => renderCustomerPickerList(document.querySelector('[data-type="all"]')), 50);
}

function renderCustomerPickerList(btn) {
  if (!btn) return;
  const type = btn.dataset.type;
  const db = window.APP.db;
  let list = db.customers || [];
  if (type !== 'all') list = list.filter(c => c.type === type);
  document.querySelectorAll('#modal-body .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const container = document.getElementById('customer-picker-list');
  if (!container) return;
  container.innerHTML = list.length === 0
    ? '<div class="empty-cell">暂无客户</div>'
    : list.map(c => `
        <div style="padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border-light);display:flex;align-items:center;gap:10px;"
             onclick="selectCustomerForOrder('${c.id}')"
             onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
          <span class="badge ${c.type==='software'?'badge-blue':'badge-green'}">${c.type==='software'?'软件':'硬件'}</span>
          <span style="flex:1;color:var(--text-primary);">${c.wechatName||''} ${c.wechatId?'('+c.wechatId+')':''}</span>
          <span style="font-size:12px;color:var(--text-muted);">${c.phone||''}</span>
        </div>
      `).join('');
}

function selectCustomerForOrder(id) {
  const db = window.APP.db;
  const c = db.customers.find(x => x.id === id);
  if (!c) return;
  document.getElementById('of-customerSearch').value = `${c.wechatName}${c.wechatId?' ('+c.wechatId+')':''}`;
  document.getElementById('of-customerId').value = id;
  closeModal();
  onCustomerChange(id);
}

// ========== 调整2：客户模糊搜索下拉 ==========
function searchCustomerDropdown(keyword) {
  const db = window.APP.db;
  const customers = db.customers || [];
  const kw = (keyword || '').toLowerCase().trim();
  let results = customers;
  if (kw) {
    results = customers.filter(c =>
      (c.wechatName||'').toLowerCase().includes(kw) ||
      (c.wechatId||'').toLowerCase().includes(kw) ||
      (c.phone||'').includes(kw)
    );
  }

  const dropdown = document.getElementById('customer-dropdown');
  if (!dropdown) return;

  if (results.length === 0) {
    dropdown.innerHTML = '<div class="dropdown-item" style="color:#94a3b8">无匹配客户</div>';
    dropdown.style.display = 'block';
    return;
  }

  dropdown.innerHTML = results.slice(0, 15).map(c => `
    <div class="dropdown-item" onclick="selectCustomer('${c.id}','${(c.wechatName||'').replace(/'/g,"\\'")}','${(c.wechatId||'').replace(/'/g,"\\'")}')">
      <span style="color:#e2e8f0">${c.wechatName||''}</span>
      ${c.wechatId?`<span style="color:#94a3b8;font-size:12px;margin-left:8px">${c.wechatId}</span>`:''}
      ${c.phone?`<span style="color:#94a3b8;font-size:12px;margin-left:8px">${c.phone}</span>`:''}
      <span class="badge ${c.type==='software'?'badge-blue':'badge-green'}" style="margin-left:6px;font-size:10px">${c.type==='software'?'软件':'硬件'}</span>
    </div>
  `).join('');
  dropdown.style.display = 'block';
}

function selectCustomer(id, name, wechatId) {
  document.getElementById('of-customerId').value = id;
  const label = name + (wechatId ? ` (${wechatId})` : '');
  document.getElementById('of-customerSearch').value = label;
  document.getElementById('customer-dropdown').style.display = 'none';
  onCustomerChange(id);
}

// 调整1：快速新增客户 — 保存/取消后均返回订单表单（保留已填数据）
function showQuickAddCustomer() {
  const typeInput = document.querySelector('input[name="of-type"]:checked')?.value || 'software';
  // 保存当前订单表单数据
  const snapshot = snapshotOrderForm();

  // 回到订单表单的通用函数（保存/取消均调用）
  function backToOrderForm(newCustomer) {
    const prefill = newCustomer
      ? { ...snapshot, customerId: newCustomer.id }
      : { ...snapshot };
    showAddOrderModal(snapshot.type || typeInput, prefill);
    if (newCustomer) {
      setTimeout(() => {
        const searchEl = document.getElementById('of-customerSearch');
        if (searchEl) {
          const label = newCustomer.wechatName + (newCustomer.wechatId ? ` (${newCustomer.wechatId})` : '');
          searchEl.value = label;
        }
        const idEl = document.getElementById('of-customerId');
        if (idEl) idEl.value = newCustomer.id;
      }, 80);
    }
  }

  // 打开新增客户弹窗，并替换弹窗内「取消」按钮和右上角关闭按钮的行为
  showAddCustomerModal({ type: typeInput }, backToOrderForm);

  // 覆盖弹窗内取消按钮的行为：点击取消也回到订单表单
  setTimeout(() => {
    // 替换底部「取消」按钮
    const footerBtns = document.querySelectorAll('#modal-overlay .btn-secondary');
    footerBtns.forEach(btn => {
      if (btn.textContent.trim() === '取消') {
        btn.onclick = (e) => { e.preventDefault(); backToOrderForm(null); };
      }
    });
    // 替换右上角 × 关闭按钮
    const closeBtn = document.querySelector('#modal-overlay button[onclick="closeModal()"]');
    if (closeBtn) {
      closeBtn.onclick = (e) => { e.preventDefault(); backToOrderForm(null); };
    }
  }, 80);
}

// 快照当前订单表单（用于返回时恢复）
function snapshotOrderForm() {
  const snap = {};
  try {
    snap.type = document.querySelector('input[name="of-type"]:checked')?.value || 'software';
    snap.customerId = document.getElementById('of-customerId')?.value || '';
    snap.productId = document.getElementById('of-productId')?.value || '';
    snap.qty = document.getElementById('of-qty')?.value || 1;
    snap.price = document.getElementById('of-price')?.value || '';
    snap.totalAmount = document.getElementById('of-amount')?.value || '';
    snap.discount = document.getElementById('of-discount')?.value || '';
    snap.isOldCustomer = document.getElementById('of-isOld')?.checked || false;
    snap.orderDate = document.getElementById('of-orderDate')?.value || '';
    snap.note = document.getElementById('of-note')?.value || '';
    snap.approvalStatus = document.getElementById('of-approvalStatus')?.value || '';
    snap.approvalNote = document.getElementById('of-approvalNote')?.value || '';
    // 软件
    snap.cardId = document.getElementById('of-cardId')?.value || '';
    snap.cardCode = document.getElementById('of-cardSearch')?.value || '';
    snap.cardCategory = document.getElementById('of-cardCategory')?.value || '';
    snap.expireDate = document.getElementById('of-expireDate')?.value || '';
    snap.phoneBrand = document.getElementById('of-swPhoneBrand')?.value || document.getElementById('of-hwPhoneBrand')?.value || '';
    snap.phoneModel = document.getElementById('of-swPhoneModel')?.value || document.getElementById('of-hwPhoneModel')?.value || '';
    snap.serialNo = document.getElementById('of-serialNo')?.value || '';
    // 硬件
    snap.portType = document.getElementById('of-portType')?.value || '';
    snap.receiver = document.getElementById('of-receiver')?.value || '';
    snap.receiverPhone = document.getElementById('of-receiverPhone')?.value || '';
    snap.address = document.getElementById('of-address')?.value || '';
    snap.matchSoftware = document.getElementById('of-matchSoftware')?.value || '';
    snap.expressCompany = document.getElementById('of-expressCompany')?.value || '';
    snap.trackingNo = document.getElementById('of-trackingNo')?.value || '';
  } catch(e) {}
  return snap;
}

// ========== 调整5：卡密下拉 —— 点击直接显示全部，支持筛选 ==========
function showAllCardDropdown() {
  const keyword = document.getElementById('of-cardSearch')?.value || '';
  searchCardDropdown(keyword);
}

function searchCardDropdown(keyword) {
  const db = window.APP.db;
  const catFilter = document.getElementById('of-cardCatFilter')?.value || '';
  let cards = (db.cards || []).filter(c => c.status === 'unused');
  if (catFilter) cards = cards.filter(c => c.category === catFilter);
  if (keyword && keyword.trim()) {
    const kw = keyword.trim().toLowerCase();
    cards = cards.filter(c => (c.cardCode||'').toLowerCase().includes(kw));
  }

  const dropdown = document.getElementById('card-dropdown');
  if (!dropdown) return;

  const displayCards = cards.slice(0, 30);
  if (displayCards.length === 0) {
    // 调整5：无匹配时提示可新增
    dropdown.innerHTML = `<div class="dropdown-item" style="color:#94a3b8">
      无匹配卡密&nbsp;—&nbsp;<span style="color:#7dd3fc;cursor:pointer" onclick="confirmNewCard()">将"${keyword}"添加为新卡密</span>
    </div>`;
    dropdown.style.display = 'block';
    return;
  }

  dropdown.innerHTML = displayCards.map(c => `
    <div class="dropdown-item" onclick="selectCard('${c.id}','${(c.cardCode||'').replace(/'/g,"\\'")}','${c.category||''}','${c.expireDate||''}')">
      <span class="mono">${c.cardCode}</span>
      <span class="badge badge-gray" style="margin-left:8px">${getCardCategoryLabel(c.category)}</span>
      ${c.expireDate ? `<span style="color:#94a3b8;font-size:11px;margin-left:8px">有效至${c.expireDate}</span>` : ''}
    </div>
  `).join('');

  dropdown.style.display = 'block';
}

function selectCard(id, code, category, expireDate) {
  document.getElementById('of-cardId').value = id;
  document.getElementById('of-cardSearch').value = code;
  document.getElementById('card-dropdown').style.display = 'none';

  const display = document.getElementById('selected-card-display');
  const text = document.getElementById('selected-card-text');
  if (display) display.style.display = 'flex';
  if (text) text.textContent = code;

  if (category) {
    const catEl = document.getElementById('of-cardCategory');
    if (catEl) catEl.value = category;
  }
  if (expireDate) {
    const expEl = document.getElementById('of-expireDate');
    if (expEl) expEl.value = expireDate;
  }
}

// 调整5：确认添加新卡密（自动入库并选中）
function confirmNewCard() {
  const keyword = document.getElementById('of-cardSearch')?.value?.trim();
  if (!keyword) { showToast('请先输入卡密内容', 'warning'); return; }
  const catFilter = document.getElementById('of-cardCatFilter')?.value || '';

  const db = window.APP.db;
  // 检查是否已存在
  const existing = db.cards.find(c => c.cardCode === keyword);
  if (existing) {
    // 已存在，直接选中
    selectCard(existing.id, existing.cardCode, existing.category, existing.expireDate||'');
    showToast('已选中现有卡密');
    return;
  }
  // 新建卡密入库（状态未使用）
  const newCard = {
    id: genId(),
    category: catFilter || '',
    cardCode: keyword,
    status: 'unused',
    buyDate: todayStr(),
    expireDate: '',
    relatedOrderNo: '',
    relatedWechatName: '',
    relatedWechatId: '',
    note: '从订单表单添加',
    createdAt: Date.now()
  };
  db.cards = db.cards || [];
  db.cards.push(newCard);
  saveDB();
  selectCard(newCard.id, newCard.cardCode, newCard.category, '');
  showToast('新卡密已入库并选中', 'success');
  document.getElementById('card-dropdown').style.display = 'none';
}

function clearSelectedCard() {
  document.getElementById('of-cardId').value = '';
  document.getElementById('of-cardSearch').value = '';
  const display = document.getElementById('selected-card-display');
  if (display) display.style.display = 'none';
}

// ==================== 保存订单 ====================
function saveOrder(editId = null) {
  const typeEl = document.querySelector('input[name="of-type"]:checked');
  if (!typeEl) { showToast('请选择订单类型', 'error'); return; }
  const type = typeEl.value;

  const customerId = document.getElementById('of-customerId')?.value;
  if (!customerId) { showToast('请选择关联客户', 'error'); return; }

  const productId = document.getElementById('of-productId')?.value;
  if (!productId) { showToast('请选择关联商品', 'error'); return; }

  const db = window.APP.db;
  const customer = db.customers.find(c => c.id === customerId);
  const product = db.products.find(p => p.id === productId);
  if (!customer || !product) { showToast('客户或商品信息无效', 'error'); return; }

  const qty = parseInt(document.getElementById('of-qty')?.value) || 1;
  const price = parseFloat(document.getElementById('of-price')?.value) || 0;
  const discount = parseFloat(document.getElementById('of-discount')?.value) || null;
  const isOld = document.getElementById('of-isOld')?.checked || false;
  const totalAmount = isOld ? 0 : parseFloat(document.getElementById('of-amount')?.value) || 0;
  const cost = isOld ? 0 : product.cost * qty;
  const profit = isOld ? 0 : totalAmount - cost;

  const orderDateVal = document.getElementById('of-orderDate')?.value;
  const orderDate = orderDateVal ? new Date(orderDateVal).getTime() : Date.now();

  const cardId = document.getElementById('of-cardId')?.value || '';
  const cardSearch = document.getElementById('of-cardSearch')?.value || '';

  const order = {
    type,
    customerId,
    customerName: customer.wechatName,
    wechatName: customer.wechatName,
    wechatId: customer.wechatId || '',
    productId,
    productName: product.name,
    qty,
    price,
    discount: discount,
    totalAmount,
    cost,
    profit,
    isOldCustomer: isOld,
    orderDate,
    approvalStatus: document.getElementById('of-approvalStatus')?.value || '',
    approvalNote: document.getElementById('of-approvalNote')?.value || '',
    note: document.getElementById('of-note')?.value || ''
  };

  if (type === 'software') {
    order.cardId = cardId;
    order.cardCode = cardSearch;
    order.cardCategory = document.getElementById('of-cardCategory')?.value || '';
    order.expireDate = document.getElementById('of-expireDate')?.value || '';
    order.phoneBrand = document.getElementById('of-swPhoneBrand')?.value || '';
    order.phoneModel = document.getElementById('of-swPhoneModel')?.value || '';
    order.serialNo = document.getElementById('of-serialNo')?.value || '';
  } else {
    order.portType = document.getElementById('of-portType')?.value || '';
    order.phoneBrand = document.getElementById('of-hwPhoneBrand')?.value || '';
    order.phoneModel = document.getElementById('of-hwPhoneModel')?.value || '';
    order.receiver = document.getElementById('of-receiver')?.value || '';
    order.receiverPhone = document.getElementById('of-receiverPhone')?.value || '';
    order.address = document.getElementById('of-address')?.value || '';
    order.matchSoftware = document.getElementById('of-matchSoftware')?.value || '';
    order.expressCompany = document.getElementById('of-expressCompany')?.value || '';
    order.trackingNo = document.getElementById('of-trackingNo')?.value || '';
    order.btName = document.getElementById('of-btName')?.value || '';
    order.btMac = document.getElementById('of-btMac')?.value || '';
  }

  if (editId) {
    const idx = db.orders.findIndex(o => o.id === editId);
    if (idx === -1) { showToast('订单不存在', 'error'); return; }
    const oldOrder = db.orders[idx];
    order.id = editId;
    order.orderNo = oldOrder.orderNo;
    order.createdAt = oldOrder.createdAt;
    order.cardHistory = oldOrder.cardHistory || [];
    order.deviceHistory = oldOrder.deviceHistory || [];
    db.orders[idx] = order;
    showToast('订单已更新');
  } else {
    order.id = genId();
    order.orderNo = genOrderNo(type);
    order.createdAt = orderDate;
    order.cardHistory = [];
    order.deviceHistory = [];
    db.orders.push(order);

    // 更新卡密状态
    if (cardId) {
      const card = db.cards.find(c => c.id === cardId);
      if (card) {
        card.status = 'used';
        card.relatedOrderNo = order.orderNo;
        card.relatedWechatName = customer.wechatName;
        card.relatedWechatId = customer.wechatId || '';
      }
    }

    // 记录购卡记录
    if (type === 'software' && (cardId || cardSearch)) {
      db.cardRecords = db.cardRecords || [];
      db.cardRecords.push({
        id: genId(),
        customerId,
        orderNo: order.orderNo,
        cardCode: cardSearch,
        oldCardCode: '',
        category: order.cardCategory,
        expireDate: order.expireDate,
        opDate: todayStr(),
        opType: 'buy',
        note: '',
        createdAt: Date.now()
      });
    }

    showToast('订单创建成功');
  }

  saveDB();
  closeModal();
  renderOrders();
}

function showEditOrderModal(id) {
  const db = window.APP.db;
  const o = db.orders.find(o => o.id === id);
  if (!o) return;
  showAddOrderModal(o.type, { ...o });
}

function deleteOrder(id) {
  const db = window.APP.db;
  const o = db.orders.find(o => o.id === id);
  if (!o) return;
  confirmDialog(`确定删除订单「${o.orderNo}」吗？`, () => {
    db.orders = db.orders.filter(o => o.id !== id);
    saveDB();
    showToast('订单已删除');
    renderOrders();
  }, '删除订单');
}

// ==================== 订单详情弹窗 ====================
function showOrderDetail(id) {
  const db = window.APP.db;
  const o = db.orders.find(o => o.id === id);
  if (!o) return;

  const isSw = o.type === 'software';
  const approvalLabels = { '': '-', pending: '审批中', approved: '已通过', rejected: '已拒绝' };

  // 调整9：卡密直接显示并支持点击复制，补充显示剩余有效时间
  const cardCodeHtml = o.cardCode ? `
    <div class="detail-item form-full">
      <span class="detail-key">卡密</span>
      <span class="detail-val" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;">
        <span class="mono card-clickcopy" style="color:#7dd3fc;cursor:pointer;padding:2px 6px;background:#0f172a;border-radius:4px;"
          title="点击复制" onclick="copyToClipboard('${o.cardCode.replace(/'/g,"\\'")}','卡密已复制')">${o.cardCode}</span>
        <button class="btn-copy-inline" onclick="copyToClipboard('${o.cardCode.replace(/'/g,"\\'")}','卡密已复制')" style="margin-left:2px">⎘ 复制</button>
        ${o.expireDate ? `<span style="margin-left:4px;">${formatRemainingTime(o.expireDate)}</span><span style="color:#94a3b8;font-size:12px;">（有效期至 ${o.expireDate}）</span>` : ''}
      </span>
    </div>` : '';

  const content = `
    <div class="detail-section">
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-key">订单号</span><span class="detail-val mono">${o.orderNo||'-'}</span></div>
        <div class="detail-item"><span class="detail-key">订单类型</span><span class="detail-val">${isSw?'软件订单':'硬件订单'}</span></div>
        <div class="detail-item"><span class="detail-key">客户</span><span class="detail-val">${o.wechatName||'-'}${o.wechatId?' ('+o.wechatId+')':''}</span></div>
        <div class="detail-item"><span class="detail-key">产品名称</span><span class="detail-val">${o.productName||'-'}</span></div>
        <div class="detail-item"><span class="detail-key">数量</span><span class="detail-val">${o.qty||1}</span></div>
        <div class="detail-item"><span class="detail-key">单价</span><span class="detail-val">¥${formatMoney(o.price)}</span></div>
        <div class="detail-item"><span class="detail-key">总金额</span><span class="detail-val" style="color:#7dd3fc;font-weight:600">¥${formatMoney(o.totalAmount)}</span></div>
        ${o.discount ? `<div class="detail-item"><span class="detail-key">折扣</span><span class="detail-val">${(o.discount*10).toFixed(1)}折</span></div>` : ''}
        <div class="detail-item"><span class="detail-key">购买日期</span><span class="detail-val">${formatDate(new Date(o.orderDate||o.createdAt),'YYYY-MM-DD HH:mm:ss')}</span></div>
        <div class="detail-item"><span class="detail-key">老客户</span><span class="detail-val">${o.isOldCustomer?'是':'否'}</span></div>
        ${o.note ? `<div class="detail-item form-full"><span class="detail-key">备注</span><span class="detail-val">${o.note}</span></div>` : ''}
        <div class="detail-item"><span class="detail-key">审批状态</span><span class="detail-val">${approvalLabels[o.approvalStatus]||'-'}</span></div>
        ${o.approvalNote ? `<div class="detail-item"><span class="detail-key">审批意见</span><span class="detail-val">${o.approvalNote}</span></div>` : ''}
      </div>
    </div>

    ${isSw ? `
    <div class="detail-section">
      <div class="detail-title">软件信息</div>
      <div class="detail-grid">
        ${cardCodeHtml}
        <div class="detail-item"><span class="detail-key">卡密分类</span><span class="detail-val">${getCardCategoryLabel(o.cardCategory)||'-'}</span></div>
        <div class="detail-item"><span class="detail-key">有效期至</span><span class="detail-val">${o.expireDate||'-'}</span></div>
        <div class="detail-item"><span class="detail-key">手机品牌</span><span class="detail-val">${o.phoneBrand||'-'}</span></div>
        <div class="detail-item"><span class="detail-key">手机型号</span><span class="detail-val">${o.phoneModel||'-'}</span></div>
        <div class="detail-item"><span class="detail-key">序列号</span><span class="detail-val">${o.serialNo||'-'}</span></div>
      </div>
    </div>` : `
    <div class="detail-section">
      <div class="detail-title">硬件信息</div>
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-key">插口类型</span><span class="detail-val">${o.portType||'-'}</span></div>
        <div class="detail-item"><span class="detail-key">手机品牌</span><span class="detail-val">${o.phoneBrand||'-'}</span></div>
        <div class="detail-item"><span class="detail-key">手机型号</span><span class="detail-val">${o.phoneModel||'-'}</span></div>
        <div class="detail-item"><span class="detail-key">收件人</span><span class="detail-val">${o.receiver||'-'}</span></div>
        <div class="detail-item"><span class="detail-key">收货手机</span><span class="detail-val">${o.receiverPhone||'-'}</span></div>
        <div class="detail-item form-full"><span class="detail-key">收货地址</span><span class="detail-val">${o.address||'-'}</span></div>
        <div class="detail-item"><span class="detail-key">匹配软件</span><span class="detail-val">${o.matchSoftware||'-'}</span></div>
        <div class="detail-item"><span class="detail-key">快递公司</span><span class="detail-val">${o.expressCompany||'-'}</span></div>
        <div class="detail-item">
          <span class="detail-key">物流单号</span>
          <span class="detail-val">
            ${o.trackingNo||'-'}
            ${o.trackingNo && o.expressCompany ? `<button class="btn-xs btn-primary" style="margin-left:8px" onclick="queryExpress('${o.expressCompany}','${o.trackingNo}')">查物流</button>` : ''}
          </span>
        </div>
        ${o.btName ? `<div class="detail-item"><span class="detail-key">蓝牙设备</span><span class="detail-val">${o.btName}</span></div>` : ''}
        ${o.btMac ? `<div class="detail-item"><span class="detail-key">蓝牙MAC</span><span class="detail-val">${o.btMac}</span></div>` : ''}
      </div>
    </div>`}

    ${(o.cardHistory||[]).length > 0 ? `
    <div class="detail-section">
      <div class="detail-title">换卡历史</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>序号</th><th>旧卡密</th><th>新卡密</th><th>换卡时间</th><th>备注</th></tr></thead>
          <tbody>
            ${(o.cardHistory||[]).map((h,idx)=>`<tr>
              <td>${idx+1}</td>
              <td><span class="mono card-clickcopy" style="cursor:pointer" onclick="copyToClipboard('${(h.oldCard||'').replace(/'/g,"\\'")}','旧卡密已复制')" title="点击复制">${h.oldCard||'-'}</span><button class="btn-copy-inline" onclick="copyToClipboard('${(h.oldCard||'').replace(/'/g,"\\'")}','旧卡密已复制')">⎘</button></td>
              <td><span class="mono card-clickcopy" style="cursor:pointer" onclick="copyToClipboard('${(h.newCard||'').replace(/'/g,"\\'")}','新卡密已复制')" title="点击复制">${h.newCard||'-'}</span><button class="btn-copy-inline" onclick="copyToClipboard('${(h.newCard||'').replace(/'/g,"\\'")}','新卡密已复制')">⎘</button></td>
              <td style="font-size:12px;">${formatDate(new Date(h.time),'YYYY-MM-DD HH:mm:ss')}</td>
              <td>${h.note||'-'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}

    ${(o.deviceHistory||[]).length > 0 ? `
    <div class="detail-section">
      <div class="detail-title">更换记录</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>序号</th><th>旧设备</th><th>新设备</th><th>原因</th><th>更换时间</th></tr></thead>
          <tbody>
            ${(o.deviceHistory||[]).map((h,idx)=>`<tr>
              <td>${idx+1}</td>
              <td>${h.oldDevice||'-'}</td>
              <td>${h.newDevice||'-'}</td>
              <td>${h.reason||'-'}</td>
              <td style="font-size:12px;">${formatDate(new Date(h.time),'YYYY-MM-DD HH:mm:ss')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}

    <!-- 物流轨迹显示区（调整13：详细节点） -->
    <div id="express-track-area"></div>
  `;

  const footer = `
    <button onclick="closeModal()" class="btn-secondary">关闭</button>
    ${isSw ? `<button onclick="closeModal();showChangeCardModal('${o.id}')" class="btn-warning">换卡</button>` : `<button onclick="closeModal();showChangeDeviceModal('${o.id}')" class="btn-warning">更换设备</button>`}
    <button onclick="closeModal();showEditOrderModal('${o.id}')" class="btn-secondary">编辑</button>
    <button onclick="copyOrderByTemplate('${o.id}')" class="btn-primary">${isSw?'复制软件订单':'复制硬件订单'}</button>
  `;

  showModal(`订单详情 - ${o.orderNo}`, content, footer, 'xl');
}

// ==================== 调整13：物流查询（详细节点） ====================
async function queryExpress(company, trackingNo) {
  const db = window.APP.db;
  const customer = db.settings?.expressCustomer;
  const apiKey = db.settings?.expressKey;
  if (!customer || !apiKey) {
    showToast('请先在系统设置中配置快递100的Customer ID和API密钥', 'warning');
    return;
  }

  const trackArea = document.getElementById('express-track-area');
  if (trackArea) {
    trackArea.innerHTML = `<div class="detail-section"><div class="detail-title">物流轨迹</div><div style="color:#94a3b8;padding:12px">正在查询...</div></div>`;
  }

  try {
    const comMap = {
      '顺丰速运':'shunfeng','圆通速递':'yuantong','中通快递':'zhongtong','韵达快递':'yunda',
      '申通快递':'shentong','百世快递':'baishi','极兔速运':'jitu','邮政EMS':'ems',
      '京东物流':'jd','德邦快递':'debang'
    };
    const comCode = comMap[company] || '';
    if (!comCode) {
      showToast('暂不支持该快递公司的自动查询', 'warning');
      return;
    }
    // 调用本地代理端点（服务端处理MD5签名并转发请求，避免CORS限制）
    const resp = await fetch(`/api/express?com=${comCode}&num=${encodeURIComponent(trackingNo)}`);
    const data = await resp.json();

    if (trackArea) {
      if (data.status === '200' && data.data && data.data.length > 0) {
        // 调整13：显示每一个物流节点（时间+地点+状态）
        const rows = data.data.map(item => `
          <div class="track-node" style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
            <div style="min-width:130px;color:var(--text-muted);font-size:13px;">${item.ftime||item.time||''}</div>
            <div style="flex:1;">
              <div style="color:var(--text-primary);font-size:14px;">${item.context||''}</div>
              ${item.location ? `<div style="color:var(--text-muted);font-size:12px;margin-top:3px;">📍 ${item.location}</div>` : ''}
            </div>
          </div>
        `).join('');
        trackArea.innerHTML = `
          <div class="detail-section">
            <div class="detail-title" style="display:flex;justify-content:space-between;align-items:center;">
              <span>物流轨迹</span>
              <span style="font-size:12px;color:var(--text-muted)">${company} · ${trackingNo}</span>
            </div>
            <div style="padding:4px 0;">${rows}</div>
          </div>`;
      } else {
        trackArea.innerHTML = `<div class="detail-section"><div class="detail-title">物流轨迹</div><div style="color:var(--text-muted);padding:12px">${data.message || '暂无物流信息'}</div></div>`;
      }
    }
  } catch(e) {
    if (trackArea) {
      trackArea.innerHTML = `<div class="detail-section"><div class="detail-title">物流轨迹</div><div style="color:var(--yellow);padding:12px">查询失败：${e.message || '网络错误，请检查快递100配置是否正确'}</div></div>`;
    } else {
      showToast('查询失败：' + (e.message || '网络错误，请检查配置'), 'error');
    }
  }
}

// ==================== 调整8：按模板复制订单 ====================
function copyOrderByTemplate(id) {
  const db = window.APP.db;
  const o = db.orders.find(o => o.id === id);
  if (!o) return;

  const template = o.type === 'software'
    ? db.settings.softwareCopyTemplate
    : db.settings.hardwareCopyTemplate;

  const vars = o.type === 'software' ? {
    '产品名称': o.productName||'',
    '订单号': o.orderNo||'',
    '卡密': o.cardCode||'',
    '购买日期': formatDate(new Date(o.orderDate||o.createdAt),'YYYY-MM-DD HH:mm:ss'),
    '有效期': o.expireDate||'',
    '客户名称': o.wechatName||'',
    '数量': String(o.qty||1),
    '金额': formatMoney(o.totalAmount),
    '手机品牌': o.phoneBrand||'',
    '手机型号': o.phoneModel||'',
    '序列号': o.serialNo||''
  } : {
    '产品名称': o.productName||'',
    '订单号': o.orderNo||'',
    '收件人': o.receiver||'',
    '收件人手机': o.receiverPhone||'',
    '收货地址': o.address||'',
    '快递公司': o.expressCompany||'',
    '物流单号': o.trackingNo||'',
    '数量': String(o.qty||1),
    '金额': formatMoney(o.totalAmount),
    '手机品牌': o.phoneBrand||'',
    '手机型号': o.phoneModel||'',
    '插口类型': o.portType||'',
    '匹配软件': o.matchSoftware||''
  };

  const text = renderTemplate(template, vars);
  copyToClipboard(text, '订单信息已复制');
}
