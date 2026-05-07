/**
 * 卡密库.js - 销售客户管理系统 v3.0.0
 * 职责：卡密列表、新增/编辑/删除/批量导入、搜索过滤、详情
 */

// ==================== 事件委托（解决 onclick 在某些环境下不触发的问题）====================
document.addEventListener('click', function(e) {
  var el = e.target.closest('[data-action]');
  if (!el) return;
  var action = el.getAttribute('data-action');
  var id = el.getAttribute('data-id');
  if (action === 'delete-card') {
    if (id) window.deleteCard(id);
  } else if (action === 'edit-card') {
    if (id) window.showEditCardModal(id);
  } else if (action === 'view-card') {
    if (id) window.showCardDetail(id);
  }
});

let cardPage = 1;
let cardCatFilter = '';
let cardStatusFilter = '';
let cardKeyword = '';
let cardSelected = []; // 已选中的卡密ID列表

function renderCards() {
  const el = document.getElementById('page-cards');
  if (!el) return;
  const db = window.APP.db;
  let list = [...(db.cards || [])].sort((a, b) => b.createdAt - a.createdAt);

  if (cardCatFilter) list = list.filter(c => c.category === cardCatFilter);
  if (cardStatusFilter) list = list.filter(c => c.status === cardStatusFilter);
  if (cardKeyword) list = filterList(list, cardKeyword, ['cardCode', 'relatedWechatName', 'relatedWechatId']);

  const pager = paginate(list, cardPage, 15);

  const total = db.cards.length;
  const unused = db.cards.filter(c => c.status === 'unused').length;
  const used = db.cards.filter(c => c.status === 'used').length;
  const replaced = db.cards.filter(c => c.status === 'replaced').length;

  el.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">卡密库</h2>
      <div style="display:flex;gap:8px;">
        <button class="btn-danger" onclick="batchDeleteCards()" ${cardSelected.length===0?'disabled style="opacity:0.5;cursor:not-allowed;"':''}>批量删除 (${cardSelected.length})</button>
        <button class="btn-secondary" onclick="batchChangeCategory()" ${cardSelected.length===0?'disabled style="opacity:0.5;cursor:not-allowed;"':''}>批量改分类</button>
        <button class="btn-secondary" onclick="showBatchImportCards()">📥 批量导入</button>
        <button class="btn-primary" onclick="showAddCardModal()">+ 新增卡密</button>
      </div>
    </div>
    <div class="stats-mini">
      <span>总计 <b>${total}</b></span>
      <span class="text-success">未使用 <b>${unused}</b></span>
      <span class="text-warning">已使用 <b>${used}</b></span>
      <span class="text-muted">已替换 <b>${replaced}</b></span>
    </div>
    <div class="toolbar">
      <div class="filter-tabs">
        <button class="filter-tab ${!cardCatFilter?'active':''}" onclick="setCardCatFilter('')">全部分类</button>
        ${['temp','monthly','quarterly','halfyear','yearly','permanent'].map(c=>
          `<button class="filter-tab ${cardCatFilter===c?'active':''}" onclick="setCardCatFilter('${c}')">${getCardCategoryLabel(c)}</button>`
        ).join('')}
      </div>
    </div>
    <div class="toolbar">
      <div class="filter-tabs">
        <button class="filter-tab ${!cardStatusFilter?'active':''}" onclick="setCardStatusFilter('')">全部状态</button>
        <button class="filter-tab ${cardStatusFilter==='unused'?'active':''}" onclick="setCardStatusFilter('unused')">未使用</button>
        <button class="filter-tab ${cardStatusFilter==='used'?'active':''}" onclick="setCardStatusFilter('used')">已使用</button>
        <button class="filter-tab ${cardStatusFilter==='replaced'?'active':''}" onclick="setCardStatusFilter('replaced')">已替换</button>
      </div>
      <div class="search-box">
        <input type="text" placeholder="搜索卡密/客户微信..." value="${cardKeyword}"
          oninput="cardKeyword=this.value;cardPage=1;renderCards()">
      </div>
    </div>
    <div class="section-card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th style="width:40px;"><input type="checkbox" onchange="toggleCardSelectAll(this)" ${pager.items.length===0?'disabled':''}></th>
            <th>序号</th><th>分类</th><th>卡密</th><th>状态</th>
            <th>购买时间</th><th>添加时间</th><th>剩余天数</th><th>有效期</th><th>使用客户</th><th>操作</th>
          </tr></thead>
          <tbody>
            ${pager.items.length === 0 ? `<tr><td colspan="11" class="empty-cell">暂无卡密数据</td></tr>` :
              pager.items.map((c, idx) => {
                const days = calcRemainingDays(c.expireDate);
                const isChecked = cardSelected.includes(c.id);
                let daysCls = '', daysText = '';
                if (c.category === 'permanent') { daysText = '永久'; daysCls = 'text-success'; }
                else if (days === null) { daysText = '-'; }
                else if (days < 0) { daysText = '已过期'; daysCls = 'text-danger'; }
                else if (days <= 7) { daysText = `${days}天`; daysCls = 'text-danger'; }
                else if (days <= 30) { daysText = `${days}天`; daysCls = 'text-warning'; }
                else { daysText = `${days}天`; daysCls = 'text-success'; }

                const statusMap = { unused: ['未使用', 'badge-success'], used: ['已使用', 'badge-blue'], replaced: ['已替换', 'badge-gray'] };
                const [statusLabel, statusBadge] = statusMap[c.status] || ['未知', 'badge-gray'];

                return `<tr>
                  <td><input type="checkbox" class="card-cb" value="${c.id}" ${isChecked?'checked':''} onchange="onCardCheckChange('${c.id}', this.checked)"></td>
                  <td>${(cardPage-1)*15+idx+1}</td>
                  <td><span class="badge badge-purple">${getCardCategoryLabel(c.category)}</span></td>
                  <td>
                    <span class="mono card-text">${c.cardCode}</span>
                    <button class="btn-copy-inline" onclick="copyToClipboard('${c.cardCode.replace(/'/g,"\\'")}','卡密已复制')" title="复制卡密">⎘</button>
                  </td>
                  <td><span class="badge ${statusBadge}">${statusLabel}</span></td>
                  <td>${c.purchaseDate||'-'}</td>
                  <td style="font-size:12px;">${c.addedTime||'-'}</td>
                  <td class="${daysCls}">${daysText}</td>
                  <td>${c.expireDate && c.category!=='permanent' ? c.expireDate : (c.category==='permanent'?'永久':'-')}</td>
                  <td>${c.relatedWechatName||'-'}${c.relatedWechatId?' ('+c.relatedWechatId+')':''}</td>
                  <td class="action-cell">
                    <button class="btn-xs btn-primary" onclick="showCardDetail('${c.id}')">详情</button>
                    <button class="btn-xs btn-secondary" onclick="showEditCardModal('${c.id}')">编辑</button>
                    <button class="btn-xs btn-danger" data-action="delete-card" data-id="${c.id}">删除</button>
                  </td>
                </tr>`;
              }).join('')}
          </tbody>
        </table>
      </div>
      <div id="card-pager"></div>
    </div>
  `;
  renderPager('card-pager', pager, p => { cardPage = p; renderCards(); });
}

function setCardCatFilter(f) { cardCatFilter = f; cardPage = 1; renderCards(); }
function setCardStatusFilter(f) { cardStatusFilter = f; cardPage = 1; renderCards(); }

// ==================== 新增/编辑卡密弹窗 ====================
function showAddCardModal(prefill = {}) {
  const isEdit = !!prefill.id;
  const content = `
    <form id="card-form">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label required">分类</label>
          <select class="form-select" id="card-f-cat" onchange="onCardFormCatChange()">
            <option value="">请选择</option>
            <option value="temp" ${prefill.category==='temp'?'selected':''}>临时卡</option>
            <option value="monthly" ${prefill.category==='monthly'?'selected':''}>月卡</option>
            <option value="quarterly" ${prefill.category==='quarterly'?'selected':''}>季卡</option>
            <option value="halfyear" ${prefill.category==='halfyear'?'selected':''}>半年卡</option>
            <option value="yearly" ${prefill.category==='yearly'?'selected':''}>年卡</option>
            <option value="permanent" ${prefill.category==='permanent'?'selected':''}>永久卡</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label required">卡密</label>
          <div style="display:flex;gap:6px;align-items:center;">
            <input type="text" class="form-input" id="card-f-code" value="${prefill.cardCode||''}" placeholder="请输入卡密" style="flex:1">
            ${isEdit && prefill.cardCode ? `<button type="button" class="btn-copy-inline" onclick="copyToClipboard('${prefill.cardCode.replace(/'/g,"\\'")}','卡密已复制')">⎘</button>` : ''}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">购买时间</label>
          <input type="date" class="form-input" id="card-f-purchase" value="${prefill.purchaseDate||todayStr()}">
        </div>
        <div class="form-group">
          <label class="form-label">有效期至</label>
          <input type="date" class="form-input" id="card-f-expire" value="${prefill.expireDate||''}">
        </div>
        <div class="form-group">
          <label class="form-label">状态</label>
          <select class="form-select" id="card-f-status">
            <option value="unused" ${(prefill.status||'unused')==='unused'?'selected':''}>未使用</option>
            <option value="used" ${prefill.status==='used'?'selected':''}>已使用</option>
            <option value="replaced" ${prefill.status==='replaced'?'selected':''}>已替换</option>
          </select>
        </div>
        <div class="form-group form-full">
          <label class="form-label">快捷设置有效期</label>
          <div class="quick-btns">
            <button type="button" class="quick-btn" onclick="setCardQuickExpire('temp')">临时卡+1天</button>
            <button type="button" class="quick-btn" onclick="setCardQuickExpire('monthly')">月卡+30天</button>
            <button type="button" class="quick-btn" onclick="setCardQuickExpire('quarterly')">季卡+90天</button>
            <button type="button" class="quick-btn" onclick="setCardQuickExpire('halfyear')">半年+180天</button>
            <button type="button" class="quick-btn" onclick="setCardQuickExpire('yearly')">年卡+365天</button>
            <button type="button" class="quick-btn" onclick="setCardQuickExpire('permanent')">永久卡</button>
          </div>
        </div>
        <div class="form-group form-full">
          <label class="form-label">备注</label>
          <textarea class="form-textarea" id="card-f-note" placeholder="备注">${prefill.note||''}</textarea>
        </div>
      </div>
    </form>
  `;

  showModal(isEdit ? '编辑卡密' : '新增卡密', content,
    `<button onclick="closeModal()" class="btn-secondary">取消</button>
     <button onclick="saveCard(${isEdit?`'${prefill.id}'`:'null'})" class="btn-primary">${isEdit?'保存修改':'保存卡密'}</button>`);
}

function onCardFormCatChange() {
  const cat = document.getElementById('card-f-cat')?.value;
  const purchaseEl = document.getElementById('card-f-purchase');
  const expireEl = document.getElementById('card-f-expire');
  if (!cat || !expireEl) return;
  const start = purchaseEl?.value || todayStr();
  const expire = calcExpireDate(start, cat);
  if (expire) expireEl.value = expire;
}

function setCardQuickExpire(cat) {
  const purchaseEl = document.getElementById('card-f-purchase');
  const expireEl = document.getElementById('card-f-expire');
  const catEl = document.getElementById('card-f-cat');
  if (!expireEl) return;
  const start = purchaseEl?.value || todayStr();
  const expire = calcExpireDate(start, cat);
  if (expire) expireEl.value = expire;
  if (catEl) catEl.value = cat;
}

function saveCard(editId = null) {
  const code = document.getElementById('card-f-code')?.value?.trim();
  if (!code) { showToast('卡密不能为空', 'error'); return; }

  const db = window.APP.db;
  const status = document.getElementById('card-f-status')?.value || 'unused';

  // 检查重复（新增时）
  if (!editId && db.cards.some(c => c.cardCode === code)) {
    showToast('该卡密已存在', 'warning');
    return;
  }

  if (editId) {
    // 编辑模式
    const idx = db.cards.findIndex(c => c.id === editId);
    if (idx === -1) { showToast('卡密不存在', 'error'); return; }

    const oldStatus = db.cards[idx].status;
    const category = document.getElementById('card-f-cat')?.value || db.cards[idx].category || '';

    // 更新基本字段
    Object.assign(db.cards[idx], {
      category: category,
      cardCode: code,
      purchaseDate: document.getElementById('card-f-purchase')?.value || db.cards[idx].purchaseDate || todayStr(),
      status: status,
      note: document.getElementById('card-f-note')?.value || ''
    });

    // 状态为"已使用"时：只在首次切换为used时记录使用时间和计算有效期
    if (status === 'used') {
      // 如果之前没有usedTime（首次设为已使用），记录当前时间并重新计算有效期
      if (!db.cards[idx].usedTime || oldStatus !== 'used') {
        db.cards[idx].usedTime = getFullDatetime();
        if (category !== 'permanent') {
          db.cards[idx].expireDate = calcExpireDate(todayStr(), category);
        } else {
          db.cards[idx].expireDate = '';
        }
      } else {
        // 已使用状态保存：不重置usedTime，允许手动修改有效期
        db.cards[idx].expireDate = document.getElementById('card-f-expire')?.value || db.cards[idx].expireDate || '';
      }
    } else {
      // 非状态变更场景：保留原有的expireDate（或手动修改）
      db.cards[idx].expireDate = document.getElementById('card-f-expire')?.value || db.cards[idx].expireDate || '';
    }

    // 同步关联订单
    db.orders.forEach(o => {
      if (o.cardCode === db.cards[idx].cardCode || o.cardId === editId) {
        o.expireDate = db.cards[idx].expireDate;
        o.cardCategory = db.cards[idx].category;
      }
    });
    showToast('卡密已更新');
  } else {
    // 新增模式：不计算有效期，只记录添加时间
    const category = document.getElementById('card-f-cat')?.value || '';
    const card = {
      id: genId(),
      category: category,
      cardCode: code,
      purchaseDate: document.getElementById('card-f-purchase')?.value || todayStr(),
      expireDate: '',   // 添加时不计算有效期
      usedTime: '',      // 使用时间（使用后才填）
      addedTime: getFullDatetime(),  // 添加时间（年月日时分秒）
      status: status,
      note: document.getElementById('card-f-note')?.value || '',
      createdAt: Date.now(),
      relatedOrderNo: '',
      relatedWechatName: '',
      relatedWechatId: '',
      _lastModified: Date.now() // 添加时间戳用于合并
    };

    // 如果新增时状态直接为"已使用"，记录使用时间并从今天计算有效期
    if (status === 'used') {
      card.usedTime = getFullDatetime();
      if (category !== 'permanent') {
        card.expireDate = calcExpireDate(todayStr(), category);
      }
    }

    db.cards.push(card);
    showToast('卡密已添加');
  }

  saveDB();
  closeModal();
  renderCards();
}

function showEditCardModal(id) {
  const db = window.APP.db;
  const c = db.cards.find(c => c.id === id);
  if (!c) return;
  showAddCardModal({ ...c });
}

function deleteCard(id) {
  const db = window.APP.db;
  const c = db.cards.find(c => c.id === id);
  if (!c) { showToast('卡密不存在', 'error'); return; }
  confirmDialog('确定删除卡密「' + c.cardCode.substring(0,20) + '...」吗？', function() {
    db.cards = db.cards.filter(function(x) { return x.id !== id; });
    saveDB();
    showToast('卡密已删除', 'success');
    renderCards();
  });
}

// ==================== 批量导入 ====================
function showBatchImportCards() {
  const content = `
    <div class="form-group">
      <label class="form-label required">分类</label>
      <select class="form-select" id="bi-cat">
        <option value="monthly">月卡</option>
        <option value="quarterly">季卡</option>
        <option value="halfyear">半年卡</option>
        <option value="yearly">年卡</option>
        <option value="permanent">永久卡</option>
        <option value="temp">临时卡</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">购买时间</label>
      <input type="date" class="form-input" id="bi-purchase" value="${todayStr()}">
    </div>
    <div class="form-group form-full">
      <label class="form-label required">卡密列表（每行一个）</label>
      <textarea class="form-textarea" id="bi-codes" style="min-height:200px" placeholder="每行一个卡密，空行自动跳过&#10;示例：&#10;ABC123DEF456&#10;GHI789JKL012"></textarea>
    </div>
    <div class="text-muted" style="font-size:12px">已存在的卡密将自动跳过。有效期从开始使用时计算，添加时不占用时间。</div>
  `;

  showModal('批量导入卡密', content,
    `<button onclick="closeModal()" class="btn-secondary">取消</button>
     <button onclick="doBatchImportCards()" class="btn-primary">开始导入</button>`);
}

function doBatchImportCards() {
  const db = window.APP.db;
  const cat = document.getElementById('bi-cat')?.value || 'monthly';
  const purchase = document.getElementById('bi-purchase')?.value || todayStr();
  const raw = document.getElementById('bi-codes')?.value || '';

  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) { showToast('请输入卡密', 'error'); return; }

  const existing = new Set(db.cards.map(c => c.cardCode));
  let added = 0, skipped = 0;

  const now = getFullDatetime();
  const nowTs = Date.now();
  lines.forEach(code => {
    if (existing.has(code)) { skipped++; return; }
    db.cards.push({
      id: genId(),
      category: cat,
      cardCode: code,
      purchaseDate: purchase,
      expireDate: '',        // 批量导入时不计算有效期
      usedTime: '',          // 使用时间（使用后才填）
      addedTime: now,        // 添加时间（年月日时分秒）
      status: 'unused',
      note: '',
      relatedOrderNo: '',
      relatedWechatName: '',
      relatedWechatId: '',
      createdAt: nowTs,
      _lastModified: nowTs  // 添加时间戳用于合并
    });
    added++;
  });

  saveDB();
  closeModal();
  showToast(`导入完成：新增 ${added} 张，跳过 ${skipped} 张`);
  renderCards();
}

// ==================== 批量操作 ====================
function onCardCheckChange(id, checked) {
  if (checked) { if (!cardSelected.includes(id)) cardSelected.push(id); }
  else { cardSelected = cardSelected.filter(x => x !== id); }
  refreshBatchCardBtns();
}

function toggleCardSelectAll(master) {
  if (master.checked) {
    const db = window.APP.db;
    let list = [...(db.cards||[])].sort((a,b)=>b.createdAt-a.createdAt);
    if (cardCatFilter) list = list.filter(c=>c.category===cardCatFilter);
    if (cardStatusFilter) list = list.filter(c=>c.status===cardStatusFilter);
    if (cardKeyword) list = filterList(list, cardKeyword, ['cardCode','relatedWechatName','relatedWechatId']);
    cardSelected = list.map(c=>c.id);
  } else { cardSelected = []; }
  document.querySelectorAll('.card-cb').forEach(cb=>{ cb.checked = master.checked; });
  refreshBatchCardBtns();
}

function refreshBatchCardBtns() {
  document.querySelectorAll('#page-cards .page-header [onclick]').forEach(btn=>{
    if (btn.textContent.includes('批量删除')) {
      btn.disabled = cardSelected.length===0;
      btn.style.opacity = cardSelected.length===0?'0.5':'1';
      btn.textContent = `批量删除 (${cardSelected.length})`;
    }
    if (btn.textContent.includes('批量改分类')) {
      btn.disabled = cardSelected.length===0;
      btn.style.opacity = cardSelected.length===0?'0.5':'1';
    }
  });
}

function batchDeleteCards() {
  if (cardSelected.length===0){showToast('请先选择卡密','error');return;}
  confirmDialog(`确定批量删除选中的 <b>${cardSelected.length}</b> 张卡密吗？`,function(){
    const db=window.APP.db;
    db.cards = db.cards.filter(c=>!cardSelected.includes(c.id));
    saveDB();
    cardSelected=[];
    showToast('批量删除完成');
    renderCards();
  },'批量删除卡密');
}

function batchChangeCategory() {
  if (cardSelected.length===0){showToast('请先选择卡密','error');return;}
  const content=`<div class="form-group">
    <label class="form-label">将选中 ${cardSelected.length} 张卡密的分类修改为</label>
    <select class="form-select" id="batch-cat-select">
      <option value="">请选择</option>
      <option value="temp">临时卡</option>
      <option value="monthly">月卡</option>
      <option value="quarterly">季卡</option>
      <option value="halfyear">半年卡</option>
      <option value="yearly">年卡</option>
      <option value="permanent">永久卡</option>
    </select>
  </div>`;
  showModal('批量修改分类',content,
    `<button onclick="closeModal()" class="btn-secondary">取消</button>
     <button onclick="execBatchChangeCategory()" class="btn-primary">确认修改</button>`);
}

function execBatchChangeCategory() {
  const cat=document.getElementById('batch-cat-select')?.value;
  if(!cat){showToast('请选择分类','error');return;}
  const db=window.APP.db;
  cardSelected.forEach(id=>{
    const c=db.cards.find(c=>c.id===id);
    if(c){c.category=cat; if(cat==='permanent')c.expireDate='';}
  });
  saveDB();
  closeModal();
  showToast(`已将 ${cardSelected.length} 张卡密改为「${getCardCategoryLabel(cat)}」`);
  cardSelected=[];
  renderCards();
}

// ==================== 卡密详情 ====================
function showCardDetail(id) {
  const db = window.APP.db;
  const c = db.cards.find(c => c.id === id);
  if (!c) return;

  const days = calcRemainingDays(c.expireDate);
  let daysText = '-', daysCls = '';
  if (c.category === 'permanent') { daysText = '永久'; daysCls = 'text-success'; }
  else if (days === null) { daysText = '-'; }
  else if (days < 0) { daysText = '已过期'; daysCls = 'text-danger'; }
  else if (days <= 7) { daysText = `${days}天`; daysCls = 'text-danger'; }
  else if (days <= 30) { daysText = `${days}天`; daysCls = 'text-warning'; }
  else { daysText = `${days}天`; daysCls = 'text-success'; }

  const statusMap = { unused: '未使用', used: '已使用', replaced: '已替换' };
  const records = (db.cardRecords || []).filter(r => r.cardCode === c.cardCode);

  const content = `
    <div class="detail-section">
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-key">分类</span><span class="detail-val">${getCardCategoryLabel(c.category)}</span></div>
        <div class="detail-item form-full">
          <span class="detail-key">卡密</span>
          <span class="detail-val">
            <span class="mono card-text">${c.cardCode}</span>
            <button class="btn-copy-inline" onclick="copyToClipboard('${c.cardCode.replace(/'/g,"\\'")}','卡密已复制')">⎘ 复制</button>
          </span>
        </div>
        <div class="detail-item"><span class="detail-key">状态</span><span class="detail-val">${statusMap[c.status]||'-'}</span></div>
        <div class="detail-item"><span class="detail-key">购买时间</span><span class="detail-val">${c.purchaseDate||'-'}</span></div>
        <div class="detail-item"><span class="detail-key">添加时间</span><span class="detail-val">${c.addedTime||'-'}</span></div>
        <div class="detail-item"><span class="detail-key">使用时间</span><span class="detail-val">${c.usedTime||'-'}</span></div>
        <div class="detail-item"><span class="detail-key">剩余天数</span><span class="detail-val ${daysCls}">${daysText}</span></div>
        <div class="detail-item"><span class="detail-key">有效期至</span><span class="detail-val">${c.expireDate && c.category!=='permanent' ? c.expireDate : (c.category==='permanent'?'永久':(c.status==='unused'?'未使用':'未知'))}</span></div>
        <div class="detail-item"><span class="detail-key">创建时间</span><span class="detail-val">${formatDate(new Date(c.createdAt),'YYYY-MM-DD HH:mm')}</span></div>
        ${c.relatedWechatName ? `<div class="detail-item"><span class="detail-key">关联客户</span><span class="detail-val">${c.relatedWechatName}${c.relatedWechatId?' ('+c.relatedWechatId+')':''}</span></div>` : ''}
        ${c.relatedOrderNo ? `<div class="detail-item"><span class="detail-key">关联订单</span><span class="detail-val mono">${c.relatedOrderNo}</span></div>` : ''}
        ${c.note ? `<div class="detail-item form-full"><span class="detail-key">备注</span><span class="detail-val">${c.note}</span></div>` : ''}
      </div>
    </div>

    ${records.length > 0 ? `
    <div class="detail-section">
      <div class="detail-title">购卡操作记录</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>类型</th><th>订单号</th><th>有效期</th><th>操作日期</th><th>备注</th></tr></thead>
          <tbody>
            ${records.map(r=>`<tr>
              <td><span class="badge ${r.opType==='buy'?'badge-blue':'badge-warning'}">${r.opType==='buy'?'购买':'换卡'}</span></td>
              <td class="mono">${r.orderNo||'-'}</td>
              <td>${r.expireDate||'-'}</td>
              <td>${r.opDate||'-'}</td>
              <td>${r.note||'-'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}
  `;

  showModal(`卡密详情`, content,
    `<button onclick="closeModal()" class="btn-secondary">关闭</button>
     <button onclick="closeModal();showEditCardModal('${id}')" class="btn-primary">编辑</button>`, 'lg');
}
