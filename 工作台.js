/**
 * 工作台.js - 销售客户管理系统 v3.3.0
 * 职责：工作台首页渲染逻辑
 * 调整：1.统计卡片点击跳转明细 2.表格显示序号 3.购买日期精确到时分秒
 */

function renderDashboard() {
  const db = window.APP.db;
  const customers = db.customers || [];
  const orders = db.orders || [];
  const cards = db.cards || [];

  // 统计数据
  const softCustomers = customers.filter(c => c.type === 'software').length;
  const hardCustomers = customers.filter(c => c.type === 'hardware').length;
  const totalCustomers = customers.length;

  const validOrders = orders.filter(o => !o.isOldCustomer);
  const totalOrders = validOrders.length;
  const todayOrders = orders.filter(o => formatDate(new Date(o.createdAt), 'YYYY-MM-DD') === todayStr()).length;
  const totalSales = validOrders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const totalProfit = validOrders.reduce((s, o) => s + (Number(o.profit) || 0), 0);

  const totalCards = cards.length;
  const unusedCards = cards.filter(c => c.status === 'unused').length;

  // 新增：软件/硬件订单统计
  const softwareOrders = orders.filter(o => o.type === 'software').length;
  const hardwareOrders = orders.filter(o => o.type === 'hardware').length;

  // 新增：商品管理/产品销售统计
  const totalProducts = (db.products || []).length;
  const onSaleCount = (db.productSalesData ? Object.values(db.productSalesData).filter(s => s.status === 'active').length : 0);

  // 即将到期（30天内）
  const expiringSoon = orders.filter(o => {
    if (o.type !== 'software' || !o.expireDate) return false;
    const days = calcRemainingDays(o.expireDate);
    return days !== null && days >= 0 && days <= 30;
  }).sort((a, b) => new Date(a.expireDate) - new Date(b.expireDate));

  // 最近8条订单
  const recentOrders = [...orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);

  const el = document.getElementById('page-dashboard');
  if (!el) return;

  el.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">工作台</h2>
      <span class="page-subtitle">欢迎使用销售客户管理系统</span>
    </div>

    <!-- 统计卡片（调整：全部可点击跳转） -->
    <div class="stats-grid">
      <div class="stat-card stat-clickable" onclick="navigateTo('customers')" title="点击查看客户列表" style="cursor:pointer;">
        <div class="stat-icon" style="background:linear-gradient(135deg,#667eea,#764ba2)">👥</div>
        <div class="stat-body">
          <div class="stat-value">${totalCustomers}</div>
          <div class="stat-label">客户总数 <span class="stat-click-hint">📋</span></div>
          <div class="stat-sub">软件 ${softCustomers} · 硬件 ${hardCustomers}</div>
        </div>
      </div>
      <div class="stat-card stat-clickable" onclick="showStatDetail('总销售额')" title="点击查看全部订单" style="cursor:pointer;">
        <div class="stat-icon" style="background:linear-gradient(135deg,#f093fb,#f5576c)">📋</div>
        <div class="stat-body">
          <div class="stat-value">${totalOrders}</div>
          <div class="stat-label">有效订单 <span class="stat-click-hint">📋</span></div>
          <div class="stat-sub">今日新增 ${todayOrders} 条</div>
        </div>
      </div>
      <div class="stat-card stat-clickable" onclick="showStatDetail('总销售额')" title="点击查看销售明细" style="cursor:pointer;">
        <div class="stat-icon" style="background:linear-gradient(135deg,#4facfe,#00f2fe)">💰</div>
        <div class="stat-body">
          <div class="stat-value">¥${formatMoney(totalSales)}</div>
          <div class="stat-label">总销售额 <span class="stat-click-hint">📋</span></div>
          <div class="stat-sub">仅统计非老客户订单</div>
        </div>
      </div>
      <div class="stat-card stat-clickable" onclick="showStatDetail('总净利润')" title="点击查看利润明细" style="cursor:pointer;">
        <div class="stat-icon" style="background:linear-gradient(135deg,#43e97b,#38f9d7)">📈</div>
        <div class="stat-body">
          <div class="stat-value">¥${formatMoney(totalProfit)}</div>
          <div class="stat-label">总净利润 <span class="stat-click-hint">📋</span></div>
          <div class="stat-sub">销售额 - 成本</div>
        </div>
      </div>
      <div class="stat-card stat-clickable" onclick="navigateTo('cards')" title="点击查看卡密库" style="cursor:pointer;">
        <div class="stat-icon" style="background:linear-gradient(135deg,#fa709a,#fee140)">🔑</div>
        <div class="stat-body">
          <div class="stat-value">${totalCards}</div>
          <div class="stat-label">卡密总数 <span class="stat-click-hint">📋</span></div>
          <div class="stat-sub">未使用 ${unusedCards} 张</div>
        </div>
      </div>
      <div class="stat-card stat-clickable" onclick="navigateTo('orders-software')" title="点击查看软件订单" style="cursor:pointer;">
        <div class="stat-icon" style="background:linear-gradient(135deg,#667eea,#764ba2)">💾</div>
        <div class="stat-body">
          <div class="stat-value">${softwareOrders}</div>
          <div class="stat-label">软件订单 <span class="stat-click-hint">📋</span></div>
          <div class="stat-sub">全部软件类订单</div>
        </div>
      </div>
      <div class="stat-card stat-clickable" onclick="navigateTo('orders-hardware')" title="点击查看硬件订单" style="cursor:pointer;">
        <div class="stat-icon" style="background:linear-gradient(135deg,#f093fb,#f5576c)">💻</div>
        <div class="stat-body">
          <div class="stat-value">${hardwareOrders}</div>
          <div class="stat-label">硬件订单 <span class="stat-click-hint">📋</span></div>
          <div class="stat-sub">全部硬件类订单</div>
        </div>
      </div>
      <div class="stat-card stat-clickable" onclick="navigateTo('products')" title="点击查看商品管理" style="cursor:pointer;">
        <div class="stat-icon" style="background:linear-gradient(135deg,#4facfe,#00f2fe)">📦</div>
        <div class="stat-body">
          <div class="stat-value">${totalProducts}</div>
          <div class="stat-label">商品管理 <span class="stat-click-hint">📋</span></div>
          <div class="stat-sub">全部商品数量</div>
        </div>
      </div>
      <div class="stat-card stat-clickable" onclick="navigateTo('product-sales')" title="点击查看产品销售" style="cursor:pointer;">
        <div class="stat-icon" style="background:linear-gradient(135deg,#43e97b,#38f9d7)">📊</div>
        <div class="stat-body">
          <div class="stat-value">${onSaleCount}</div>
          <div class="stat-label">产品销售(已上架) <span class="stat-click-hint">📋</span></div>
          <div class="stat-sub">已设置销售数据的商品</div>
        </div>
      </div>
      <div class="stat-card ${expiringSoon.length > 0 ? 'stat-card--warning' : ''}">
        <div class="stat-icon" style="background:linear-gradient(135deg,#f7971e,#ffd200)">⏰</div>
        <div class="stat-body">
          <div class="stat-value">${expiringSoon.length}</div>
          <div class="stat-label">即将到期</div>
          <div class="stat-sub">30天内到期订单</div>
        </div>
      </div>
    </div>

    <!-- 即将到期提醒（添加序号列） -->
    ${expiringSoon.length > 0 ? `
    <div class="section-card" style="margin-bottom:20px;">
      <div class="section-card-header">
        <span>⚠️ 即将到期提醒（30天内）</span>
        <span class="badge badge-warning">${expiringSoon.length}条</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>序号</th><th>客户</th><th>产品</th><th>到期时间</th><th>剩余天数</th><th>操作</th></tr></thead>
          <tbody>
            ${expiringSoon.slice(0, 10).map((o, idx) => {
              const days = calcRemainingDays(o.expireDate);
              const cls = days <= 7 ? 'text-danger' : 'text-warning';
              return `<tr>
                <td>${idx+1}</td>
                <td>${o.customerName || o.wechatName || '-'}</td>
                <td style="white-space:normal;word-break:break-all;max-width:180px;">${o.productName || '-'}</td>
                <td>${o.expireDate || '-'}</td>
                <td class="${cls}">${days}天</td>
                <td><button class="btn-xs btn-primary" onclick="showOrderDetail('${o.id}')">查看</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}

    <!-- 最近订单（添加序号列 + 购买日期时分秒 + 剩余时间） -->
    <div class="section-card">
      <div class="section-card-header">
        <span>📋 最近订单</span>
        <button class="btn-xs btn-secondary" onclick="navigateTo('orders')">查看全部</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>序号</th><th>订单号</th><th>类型</th><th>产品</th><th>客户</th><th>金额</th><th>到期时间</th><th>剩余时间</th><th>操作</th></tr></thead>
          <tbody>
            ${recentOrders.length === 0 ? `<tr><td colspan="9" class="empty-cell">暂无订单数据</td></tr>` :
              recentOrders.map((o, idx) => {
                const isSoft = o.type === 'software';
                const days = isSoft ? calcRemainingDays(o.expireDate) : null;
                let daysText = '-', daysCls = '';
                if (isSoft && days !== null) {
                  if (days < 0) { daysText = '已过期'; daysCls = 'text-danger'; }
                  else if (days <= 7) { daysText = days + '天'; daysCls = 'text-danger'; }
                  else if (days <= 30) { daysText = days + '天'; daysCls = 'text-warning'; }
                  else { daysText = days + '天'; daysCls = 'text-success'; }
                }
                return `
                <tr>
                  <td>${idx+1}</td>
                  <td style="white-space:nowrap;font-size:11px;color:#94a3b8;">${o.orderNo||'-'}</td>
                  <td><span class="badge ${isSoft ? 'badge-blue' : 'badge-green'}">${isSoft ? '软件' : '硬件'}</span></td>
                  <td style="white-space:normal;word-break:break-all;max-width:140px;">${o.productName || '-'}</td>
                  <td>${o.wechatName || o.customerName || '-'}</td>
                  <td>¥${formatMoney(o.totalAmount)}</td>
                  <td style="font-size:12px;">${isSoft && o.expireDate ? o.expireDate : '-'}</td>
                  <td class="${daysCls}">${daysText}</td>
                  <td><button class="btn-xs btn-primary" onclick="showOrderDetail('${o.id}')">详情</button></td>
                </tr>`;
              }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
