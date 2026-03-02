// adminOrders.js — Order management for admin
import { supabase } from './supabaseClient.js';
import { formatBRL, formatDate, showToast } from './app.js';

const STATUS_MAP = {
  RESERVED: { label: 'Reservado', badge: 'badge-blue', icon: '📋' },
  PAID: { label: 'Pago', badge: 'badge-green', icon: '✅' },
  DELIVERED: { label: 'Entregue', badge: 'badge-accent', icon: '🎉' },
  CANCELLED: { label: 'Cancelado', badge: 'badge-red', icon: '❌' },
};
const PAY_MAP = {
  PENDING: { label: 'Pendente', badge: 'badge-yellow', icon: '⏳' },
  CONFIRMED: { label: 'Confirmado', badge: 'badge-green', icon: '✅' },
  CANCELLED: { label: 'Cancelado', badge: 'badge-red', icon: '❌' },
  REFUNDED: { label: 'Estornado', badge: 'badge-dim', icon: '↩️' },
};

let allOrders = [];

export async function loadAdminOrders() {
  const grid = document.getElementById('adminOrderGrid');
  const loader = document.getElementById('adminOrderLoader');
  if (!grid) return;
  if (loader) loader.classList.remove('hidden');

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false });

  if (loader) loader.classList.add('hidden');
  if (error) { showToast('Erro: ' + error.message, 'error'); return; }

  allOrders = data || [];
  renderAdminOrders();
  renderStats();
}

export function renderAdminOrders(statusFilter = 'all', payFilter = 'all', search = '') {
  const grid = document.getElementById('adminOrderGrid');
  if (!grid) return;

  const filtered = allOrders.filter(o => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchPay = payFilter === 'all' || o.payment_status === payFilter;
    const matchSearch = o.order_number.includes(search) || o.customer_name.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchPay && matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">📋</div><div class="empty-state-title">Nenhum pedido</div><div class="empty-state-desc">Os pedidos aparecerão aqui</div></div>`;
    return;
  }

  grid.innerHTML = filtered.map(o => {
    const si = STATUS_MAP[o.status] || STATUS_MAP.RESERVED;
    const pi = PAY_MAP[o.payment_status] || PAY_MAP.PENDING;
    const items = o.order_items || [];

    return `
      <div class="order-card fade-in">
        <div class="order-card-header">
          <div>
            <div class="order-card-number">#${o.order_number}</div>
            <div class="order-card-customer">${o.customer_name}</div>
            <div class="order-card-date">${formatDate(o.created_at)}</div>
          </div>
          <div class="order-card-badges">
            <span class="badge-pill ${si.badge}">${si.icon} ${si.label}</span>
            <span class="badge-pill ${pi.badge}">${pi.icon} ${pi.label}</span>
          </div>
        </div>
        <div class="order-card-items">
          ${items.map(i => `
            <div class="order-card-item">
              <span>${i.quantity}x ${i.product_name_snapshot}</span>
              <span>${formatBRL(i.subtotal_cents || i.subtotal * 100)}</span>
            </div>
          `).join('')}
          <div class="order-card-total">
            <span class="order-card-total-label">Total</span>
            <span class="order-card-total-value">${formatBRL(o.total_cents || o.total_amount * 100)}</span>
          </div>
        </div>
        ${o.notes ? `<div class="order-card-notes">📝 ${o.notes}</div>` : ''}
        <div class="order-card-actions">
          ${o.status === 'RESERVED' ? `
            <button class="btn btn-success btn-sm" onclick="updateOrderStatus('${o.id}','PAID')">✅ Pago</button>
            <button class="btn btn-danger btn-sm" onclick="cancelOrder('${o.id}')">❌ Cancelar</button>
          ` : ''}
          ${o.status === 'PAID' ? `
            <button class="btn btn-primary btn-sm" onclick="updateOrderStatus('${o.id}','DELIVERED')">🎉 Entregue</button>
          ` : ''}
          ${o.payment_status === 'PENDING' && o.status !== 'CANCELLED' ? `
            <button class="btn btn-secondary btn-sm" onclick="confirmPayment('${o.id}')">💰 Confirmar Pgto</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderStats() {
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = allOrders.filter(o => o.created_at?.startsWith(today));
  const revenue = allOrders.filter(o => o.payment_status === 'CONFIRMED').reduce((s, o) => s + (o.total_cents || 0), 0);
  const pending = allOrders.filter(o => o.status === 'RESERVED').length;

  const el = document.getElementById('orderStats');
  if (!el) return;
  el.innerHTML = `
    <div class="stat-card fade-up" style="animation-delay:0s">
      <div class="stat-card-header"><span class="stat-card-label">Total Pedidos</span><span class="stat-card-icon">📋</span></div>
      <div class="stat-card-value">${allOrders.length}</div>
    </div>
    <div class="stat-card fade-up" style="animation-delay:0.05s">
      <div class="stat-card-header"><span class="stat-card-label">Hoje</span><span class="stat-card-icon">📅</span></div>
      <div class="stat-card-value">${todayOrders.length}</div>
    </div>
    <div class="stat-card fade-up" style="animation-delay:0.1s">
      <div class="stat-card-header"><span class="stat-card-label">Receita</span><span class="stat-card-icon">💰</span></div>
      <div class="stat-card-value">${formatBRL(revenue)}</div>
    </div>
    <div class="stat-card fade-up" style="animation-delay:0.15s">
      <div class="stat-card-header"><span class="stat-card-label">Pendentes</span><span class="stat-card-icon">⏳</span></div>
      <div class="stat-card-value">${pending}</div>
    </div>
  `;
}

async function updateOrder(id, updates) {
  const { error } = await supabase.from('orders').update(updates).eq('id', id);
  if (error) { showToast('Erro: ' + error.message, 'error'); return; }
  showToast('Pedido atualizado!');
  await loadAdminOrders();
}

window.updateOrderStatus = (id, status) => updateOrder(id, { status });
window.confirmPayment = (id) => updateOrder(id, { payment_status: 'CONFIRMED', status: 'PAID' });
window.cancelOrder = (id) => updateOrder(id, { status: 'CANCELLED', payment_status: 'CANCELLED' });
