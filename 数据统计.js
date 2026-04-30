/**
 * 数据统计.js - 销售客户管理系统 v3.3.0
 * 职责：数据统计模块、多维度分析、图表展示
 * 调整：1.明细表格显示序号 2.工作台统计卡片点击跳转对应明细
 */

function renderStats() {
  const el = document.getElementById('page-stats');
  if (!el) return;
  const db = window.APP.db;
  const orders = db.orders || [];
  const customers = db.customers || [];
  const cards = db.cards || [];
  const cardRecords = db.cardRecords || [];

  const validOrders = orders.filter(o => !o.isOldCustomer);
  const swOrders = orders.filter(o => o.type === 'software');
  const hwOrders = orders.filter(o => o.type === 'hardware');
  const oldOrders = orders.filter(o => o.isOldCustomer);

  const totalSales = validOrders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const totalProfit = validOrders.reduce((s, o) => s + (Number(o.profit) || 0), 0);
  const swSales = validOrders.filter(o => o.type === 'software').reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const hwSales = validOrders.filter(o => o.type === 'hardware').reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);

  // 商品销售排行
  const productStats = {};
  validOrders.forEach(o => {
    const k = o.productName || '未知';
    if (!productStats[k]) productStats[k] = { count: 0, amount: 0, orders: [] };
    productStats[k].count++;
    productStats[k].amount += Number(o.totalAmount) || 0;
    productStats[k].orders.push(o);
  });
  const productRank = Object.entries(productStats).sort((a, b) => b[1].amount - a[1].amount).slice(0, 8);

  // 近7天销售
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d, 'YYYY-MM-DD');
    const dayOrders = validOrders.filter(o => formatDate(new Date(o.createdAt), 'YYYY-MM-DD') === dateStr);
    last7Days.push({
      date: formatDate(d, 'MM-DD'),
      fullDate: dateStr,
      amount: dayOrders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0),
      count: dayOrders.length,
      orders: dayOrders
    });
  }
  const max7 = Math.max(...last7Days.map(d => d.amount), 1);

  // 近30天日报
  const last30Days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d, 'YYYY-MM-DD');
    const dayOrders = validOrders.filter(o => formatDate(new Date(o.createdAt), 'YYYY-MM-DD') === dateStr);
    const dayAmt = dayOrders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
    const dayProfit = dayOrders.reduce((s, o) => s + (Number(o.profit) || 0), 0);
    if (dayOrders.length > 0) {
      last30Days.push({ date: dateStr, count: dayOrders.length, amount: dayAmt, profit: dayProfit, orders: dayOrders });
    }
  }

  // 审批状态统计
  const approvalStats = { '': 0, pending: 0, approved: 0, rejected: 0 };
  orders.forEach(o => { approvalStats[o.approvalStatus || ''] = (approvalStats[o.approvalStatus || ''] || 0) + 1; });

  // 客户分类统计
  const swCustomers = customers.filter(c => c.type === 'software').length;
  const hwCustomers = customers.filter(c => c.type === 'hardware').length;
  const catCustomerStats = {};
  customers.filter(c => c.type === 'software').forEach(c => {
    const k = getCardCategoryLabel(c.cardCategory) || '未分类';
    catCustomerStats[k] = (catCustomerStats[k] || 0) + 1;
  });

  const maxProd = Math.max(...productRank.map(([,v]) => v.amount), 1);

  el.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">数据统计</h2>
    </div>

    <!-- 汇总卡片（调整11：支持点击查看明细） -->
    <div class="stats-grid">
      <div class="stat-card stat-clickable" onclick="showStatDetail('总销售额')" title="点击查看明细">
        <div class="stat-icon" style="background:linear-gradient(135deg,#4facfe,#00f2fe)">💰</div>
        <div class="stat-body"><div class="stat-value">¥${formatMoney(totalSales)}</div><div class="stat-label">总销售额 <span class="stat-click-hint">📋</span></div></div>
      </div>
      <div class="stat-card stat-clickable" onclick="showStatDetail('总净利润')" title="点击查看明细">
        <div class="stat-icon" style="background:linear-gradient(135deg,#43e97b,#38f9d7)">📈</div>
        <div class="stat-body"><div class="stat-value">¥${formatMoney(totalProfit)}</div><div class="stat-label">总净利润 <span class="stat-click-hint">📋</span></div></div>
      </div>
      <div class="stat-card stat-clickable" onclick="showStatDetail('软件订单')" title="点击查看明细">
        <div class="stat-icon" style="background:linear-gradient(135deg,#667eea,#764ba2)">💻</div>
        <div class="stat-body"><div class="stat-value">${swOrders.length}</div><div class="stat-label">软件订单 <span class="stat-click-hint">📋</span></div><div class="stat-sub">销售额 ¥${formatMoney(swSales)}</div></div>
      </div>
      <div class="stat-card stat-clickable" onclick="showStatDetail('硬件订单')" title="点击查看明细">
        <div class="stat-icon" style="background:linear-gradient(135deg,#f093fb,#f5576c)">📦</div>
        <div class="stat-body"><div class="stat-value">${hwOrders.length}</div><div class="stat-label">硬件订单 <span class="stat-click-hint">📋</span></div><div class="stat-sub">销售额 ¥${formatMoney(hwSales)}</div></div>
      </div>
      <div class="stat-card stat-clickable" onclick="showStatDetail('老客户订单')" title="点击查看明细">
        <div class="stat-icon" style="background:linear-gradient(135deg,#fa709a,#fee140)">👴</div>
        <div class="stat-body"><div class="stat-value">${oldOrders.length}</div><div class="stat-label">老客户订单 <span class="stat-click-hint">📋</span></div><div class="stat-sub">不计入统计</div></div>
      </div>
      <div class="stat-card stat-clickable" onclick="showStatDetail('购卡记录')" title="点击查看明细">
        <div class="stat-icon" style="background:linear-gradient(135deg,#a18cd1,#fbc2eb)">📝</div>
        <div class="stat-body"><div class="stat-value">${cardRecords.length}</div><div class="stat-label">购卡记录 <span class="stat-click-hint">📋</span></div></div>
      </div>
    </div>

    <!-- 近7天销售趋势（调整11：柱状条点击查看当日明细） -->
    <div class="section-card">
      <div class="section-card-header"><span>📊 近7天销售趋势 <small style="color:#94a3b8;font-size:12px">（点击柱状条查看当日订单明细）</small></span></div>
      <div style="padding:16px 0">
        ${last7Days.map(d => `
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
            <span style="width:50px;color:#94a3b8;font-size:12px;text-align:right">${d.date}</span>
            <div style="flex:1;background:#0f172a;border-radius:4px;height:28px;position:relative;cursor:${d.count>0?'pointer':'default'}" onclick="${d.count>0?`showDayOrderDetail('${d.fullDate}','近7天销售')`:''}" title="${d.count>0?`点击查看${d.fullDate}订单明细`:''}">
              <div style="background:linear-gradient(90deg,#3b82f6,#7dd3fc);border-radius:4px;height:100%;width:${Math.max(d.count>0?4:0,d.amount/max7*100)}%;transition:width 0.5s;display:flex;align-items:center;padding-left:8px;">
                <span style="color:#fff;font-size:12px;white-space:nowrap">${d.count > 0 ? '¥'+formatMoney(d.amount)+' ('+d.count+'单)' : ''}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 商品销售排行（调整11：柱状条点击查看商品订单明细） -->
    <div class="section-card">
      <div class="section-card-header"><span>🏆 商品销售排行 <small style="color:#94a3b8;font-size:12px">（点击查看该商品所有订单）</small></span></div>
      <div style="padding:16px 0">
        ${productRank.length === 0 ? '<p class="empty-cell">暂无数据</p>' :
          productRank.map(([name, v], i) => `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;cursor:pointer;" onclick="showProductOrderDetail('${name.replace(/'/g,"\\'").replace(/"/g,'&quot;')}')" title="点击查看「${name}」所有订单">
              <span style="width:20px;color:${i<3?'#f59e0b':'#64748b'};font-weight:bold;text-align:center">${i+1}</span>
              <span style="width:220px;color:#cbd5e1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${name}">${name}</span>
              <div style="flex:1;background:#0f172a;border-radius:4px;height:24px;">
                <div style="background:linear-gradient(90deg,#7c3aed,#a78bfa);border-radius:4px;height:100%;width:${Math.max(2,v.amount/maxProd*100)}%;display:flex;align-items:center;padding-left:8px;">
                  <span style="color:#fff;font-size:11px;white-space:nowrap">¥${formatMoney(v.amount)} (${v.count}单)</span>
                </div>
              </div>
            </div>
          `).join('')}
      </div>
    </div>

    <!-- 客户分类统计（调整11：点击查看该分类客户） -->
    <div class="section-card">
      <div class="section-card-header"><span>👥 客户分类统计 <small style="color:#94a3b8;font-size:12px">（点击查看明细）</small></span></div>
      <div style="padding:16px 0;display:flex;flex-wrap:wrap;gap:16px;">
        ${[
          { label: '软件客户', count: swCustomers, color: '#3b82f6', key: 'customer_software' },
          { label: '硬件客户', count: hwCustomers, color: '#10b981', key: 'customer_hardware' },
          ...Object.entries(catCustomerStats).map(([k, v]) => ({ label: k, count: v, color: '#7c3aed', key: 'customer_cat_'+k }))
        ].map(item => `
          <div class="stat-clickable" style="background:#0f172a;border-radius:8px;padding:16px 20px;text-align:center;min-width:120px;cursor:pointer;" onclick="showCustomerCatDetail('${item.key}','${item.label}')" title="点击查看${item.label}明细">
            <div style="font-size:24px;font-weight:700;color:${item.color}">${item.count}</div>
            <div style="color:#94a3b8;font-size:12px;margin-top:4px">${item.label} <span style="font-size:10px">📋</span></div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 审批状态统计（调整11：点击查看对应状态订单） -->
    <div class="section-card">
      <div class="section-card-header"><span>✅ 审批状态统计 <small style="color:#94a3b8;font-size:12px">（点击查看对应订单）</small></span></div>
      <div style="padding:16px 0">
        ${[
          { key: '', label: '未设置', color: '#64748b' },
          { key: 'pending', label: '待审批', color: '#f59e0b' },
          { key: 'approved', label: '已通过', color: '#10b981' },
          { key: 'rejected', label: '已拒绝', color: '#ef4444' }
        ].map(item => {
          const cnt = approvalStats[item.key] || 0;
          const maxA = Math.max(...Object.values(approvalStats), 1);
          return `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;cursor:${cnt>0?'pointer':'default'}" onclick="${cnt>0?`showApprovalOrderDetail('${item.key}','${item.label}')`:''}" title="${cnt>0?`点击查看${item.label}订单`:''}">
              <span style="width:70px;color:#94a3b8;font-size:12px;text-align:right">${item.label}</span>
              <div style="flex:1;background:#0f172a;border-radius:4px;height:24px;">
                <div style="background:${item.color};border-radius:4px;height:100%;width:${Math.max(cnt>0?4:0,cnt/maxA*100)}%;display:flex;align-items:center;padding-left:8px;">
                  <span style="color:#fff;font-size:12px">${cnt > 0 ? cnt+'条' : ''}</span>
                </div>
              </div>
              <span style="width:40px;color:#94a3b8;font-size:12px">${cnt}</span>
            </div>`;
        }).join('')}
      </div>
    </div>

    <!-- 近30天日报（调整11：点击行查看当日明细） -->
    <div class="section-card">
      <div class="section-card-header"><span>📅 近30天销售日报 <small style="color:#94a3b8;font-size:12px">（点击行查看当日订单明细）</small></span></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>日期</th><th>订单数</th><th>销售金额</th><th>净利润</th></tr></thead>
          <tbody>
            ${last30Days.length === 0 ? `<tr><td colspan="4" class="empty-cell">近30天暂无订单</td></tr>` :
              last30Days.map(d => `<tr style="cursor:pointer;" onclick="showDayOrderDetail('${d.date}','近30天日报')" title="点击查看${d.date}订单明细">
                <td>${d.date}</td>
                <td>${d.count}</td>
                <td>¥${formatMoney(d.amount)}</td>
                <td class="text-success">¥${formatMoney(d.profit)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ==================== 调整11：统计明细弹窗函数 ====================

// 通用订单明细表格（含序号列，v3.3）
function _renderOrderDetailTable(orderList, title) {
  if (!orderList || orderList.length === 0) {
    return '<p class="empty-cell">暂无相关订单数据</p>';
  }
  const totalAmt = orderList.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const totalProfit = orderList.reduce((s, o) => s + (Number(o.profit) || 0), 0);
  return `
    <div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap;">
      <span style="color:#7dd3fc;font-size:13px;">共 <strong>${orderList.length}</strong> 笔订单</span>
      <span style="color:#10b981;font-size:13px;">总金额 <strong>¥${formatMoney(totalAmt)}</strong></span>
      <span style="color:#a78bfa;font-size:13px;">总利润 <strong>¥${formatMoney(totalProfit)}</strong></span>
    </div>
    <div class="table-wrap" style="max-height:60vh;overflow-y:auto;">
      <table class="data-table">
        <thead><tr><th>序号</th><th>订单号</th><th>类型</th><th>产品名称</th><th>客户</th><th>金额</th><th>利润</th><th>购买日期</th><th>操作</th></tr></thead>
        <tbody>
          ${orderList.map((o, idx) => `<tr>
            <td>${idx+1}</td>
            <td><span class="mono">${o.orderNo||'-'}</span></td>
            <td><span class="badge ${o.type==='software'?'badge-blue':'badge-green'}">${o.type==='software'?'软件':'硬件'}</span></td>
            <td style="white-space:normal;word-break:break-all;max-width:180px;">${o.productName||'-'}</td>
            <td>${o.wechatName||'-'}${o.wechatId?'<br><span style="color:#94a3b8;font-size:11px">'+o.wechatId+'</span>':''}</td>
            <td>¥${formatMoney(o.totalAmount)}</td>
            <td class="text-success">¥${formatMoney(o.profit)}</td>
            <td style="font-size:12px;">${formatDate(new Date(o.orderDate||o.createdAt),'YYYY-MM-DD HH:mm:ss')}</td>
            <td><button class="btn-xs btn-primary" onclick="closeModal();showOrderDetail('${o.id}')">详情</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// 汇总卡片点击
function showStatDetail(type) {
  const db = window.APP.db;
  const orders = db.orders || [];
  const cardRecords = db.cardRecords || [];
  let title = type;
  let content = '';

  if (type === '总销售额' || type === '总净利润') {
    const list = orders.filter(o => !o.isOldCustomer).sort((a,b) => b.createdAt - a.createdAt);
    content = _renderOrderDetailTable(list, title);
  } else if (type === '软件订单') {
    const list = orders.filter(o => o.type === 'software').sort((a,b) => b.createdAt - a.createdAt);
    content = _renderOrderDetailTable(list, title);
  } else if (type === '硬件订单') {
    const list = orders.filter(o => o.type === 'hardware').sort((a,b) => b.createdAt - a.createdAt);
    content = _renderOrderDetailTable(list, title);
  } else if (type === '老客户订单') {
    const list = orders.filter(o => o.isOldCustomer).sort((a,b) => b.createdAt - a.createdAt);
    content = _renderOrderDetailTable(list, title);
  } else if (type === '购卡记录') {
    const list = cardRecords.sort((a,b) => b.createdAt - a.createdAt);
    if (list.length === 0) {
      content = '<p class="empty-cell">暂无购卡记录</p>';
    } else {
      content = `
        <div style="margin-bottom:12px;color:#7dd3fc;font-size:13px;">共 <strong>${list.length}</strong> 条记录</div>
        <div class="table-wrap" style="max-height:60vh;overflow-y:auto;">
          <table class="data-table">
            <thead><tr><th>序号</th><th>类型</th><th>卡密</th><th>旧卡密</th><th>分类</th><th>有效期</th><th>客户</th><th>操作日期</th></tr></thead>
            <tbody>
              ${list.map((r, idx) => `<tr>
                <td>${idx+1}</td>
                <td><span class="badge ${r.opType==='buy'?'badge-blue':'badge-warning'}">${r.opType==='buy'?'购买':'换卡'}</span></td>
                <td><span class="mono">${r.cardCode||'-'}</span>${r.cardCode?`<button class="btn-copy-inline" onclick="copyToClipboard('${r.cardCode}','已复制')">⎘</button>`:''}</td>
                <td><span class="mono">${r.oldCardCode||'-'}</span></td>
                <td>${getCardCategoryLabel(r.category)||'-'}</td>
                <td>${r.expireDate||'-'}</td>
                <td>${r.relatedWechatName||'-'}</td>
                <td>${r.opDate||'-'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }
  }

  showModal(`📋 ${title} — 明细数据`, content, `<button onclick="closeModal()" class="btn-secondary">关闭</button>`, 'xl');
}

// 按日期查看订单明细
function showDayOrderDetail(dateStr, from) {
  const db = window.APP.db;
  const orders = db.orders || [];
  const list = orders
    .filter(o => !o.isOldCustomer && formatDate(new Date(o.createdAt), 'YYYY-MM-DD') === dateStr)
    .sort((a,b) => b.createdAt - a.createdAt);
  const content = _renderOrderDetailTable(list, dateStr);
  showModal(`📋 ${dateStr} 订单明细`, content, `<button onclick="closeModal()" class="btn-secondary">关闭</button>`, 'xl');
}

// 商品订单明细
function showProductOrderDetail(productName) {
  const db = window.APP.db;
  const list = (db.orders || [])
    .filter(o => !o.isOldCustomer && (o.productName || '未知') === productName)
    .sort((a,b) => b.createdAt - a.createdAt);
  const content = _renderOrderDetailTable(list, productName);
  showModal(`📋 「${productName}」订单明细`, content, `<button onclick="closeModal()" class="btn-secondary">关闭</button>`, 'xl');
}

// 审批状态订单明细
function showApprovalOrderDetail(statusKey, statusLabel) {
  const db = window.APP.db;
  const list = (db.orders || [])
    .filter(o => (o.approvalStatus || '') === statusKey)
    .sort((a,b) => b.createdAt - a.createdAt);
  const content = _renderOrderDetailTable(list, statusLabel);
  showModal(`📋 ${statusLabel} — 订单明细`, content, `<button onclick="closeModal()" class="btn-secondary">关闭</button>`, 'xl');
}

// 客户分类明细
function showCustomerCatDetail(key, label) {
  const db = window.APP.db;
  const customers = db.customers || [];
  let list = [];
  if (key === 'customer_software') {
    list = customers.filter(c => c.type === 'software');
  } else if (key === 'customer_hardware') {
    list = customers.filter(c => c.type === 'hardware');
  } else if (key.startsWith('customer_cat_')) {
    const catLabel = key.replace('customer_cat_', '');
    list = customers.filter(c => c.type === 'software' && (getCardCategoryLabel(c.cardCategory) || '未分类') === catLabel);
  }

  const content = list.length === 0
    ? '<p class="empty-cell">暂无客户数据</p>'
    : `<div style="margin-bottom:12px;color:#7dd3fc;font-size:13px;">共 <strong>${list.length}</strong> 位客户</div>
       <div class="table-wrap" style="max-height:60vh;overflow-y:auto;">
         <table class="data-table">
           <thead><tr><th>序号</th><th>微信昵称</th><th>微信号</th><th>手机号</th><th>类型</th><th>卡密分类</th><th>来源</th><th>创建时间</th></tr></thead>
           <tbody>
             ${list.map((c, idx) => `<tr>
               <td>${idx+1}</td>
               <td>${c.wechatName||'-'}</td>
               <td>${c.wechatId||'-'}${c.wechatId?`<button class="btn-copy-inline" onclick="copyToClipboard('${c.wechatId}','已复制')">⎘</button>`:''}</td>
               <td>${c.phone||'-'}</td>
               <td><span class="badge ${c.type==='software'?'badge-blue':'badge-green'}">${c.type==='software'?'软件':'硬件'}</span></td>
               <td>${getCardCategoryLabel(c.cardCategory)||'-'}</td>
               <td>${c.source||'-'}</td>
               <td>${formatDate(new Date(c.createdAt),'YYYY-MM-DD')}</td>
             </tr>`).join('')}
           </tbody>
         </table>
       </div>`;

  showModal(`📋 ${label} — 客户明细`, content, `<button onclick="closeModal()" class="btn-secondary">关闭</button>`, 'xl');
}
