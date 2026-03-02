// app.js — Shared utilities
import { getCart, updateQuantity, removeFromCart, getCartTotal, getCartCount } from './cart.js';

export function formatBRL(cents) {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

export function formatDate(iso) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ---- Toast ----
export function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="toast-dot"></div><span class="toast-msg">${msg}</span>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ---- Header rendering ----
export function renderHeader(containerId = 'header') {
  const header = document.getElementById(containerId);
  if (!header) return;

  header.innerHTML = `
    <div class="header-inner">
      <a href="/" class="header-brand">
        <span class="header-brand-icon">🔥</span>
        <div>
          <div class="header-brand-name">Cantina Essência</div>
          <div class="header-brand-sub">Ministério de Jovens</div>
        </div>
      </a>
      <div class="header-actions">
        <a href="/admin/login.html" class="admin-link">🔒 Admin</a>
        <button class="cart-btn" id="cartToggle">
          🛒 <span id="cartCountText">Carrinho</span>
          <span class="badge hidden" id="cartBadge">0</span>
        </button>
      </div>
    </div>
  `;

  document.getElementById('cartToggle').addEventListener('click', openCartDrawer);
  updateCartBadge();
}

export function updateCartBadge() {
  const count = getCartCount();
  const badge = document.getElementById('cartBadge');
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
  }
}

// ---- Cart Drawer ----
export function openCartDrawer() {
  let overlay = document.getElementById('cartOverlay');
  if (!overlay) createCartDrawer();
  overlay = document.getElementById('cartOverlay');
  const drawer = document.getElementById('cartDrawer');
  renderCartItems();
  setTimeout(() => { overlay.classList.add('open'); drawer.classList.add('open'); }, 10);
}

export function closeCartDrawer() {
  const overlay = document.getElementById('cartOverlay');
  const drawer = document.getElementById('cartDrawer');
  if (overlay) overlay.classList.remove('open');
  if (drawer) drawer.classList.remove('open');
}

function createCartDrawer() {
  const html = `
    <div class="cart-overlay" id="cartOverlay"></div>
    <div class="cart-drawer" id="cartDrawer">
      <div class="cart-drawer-header">
        <h2>🛒 Carrinho</h2>
        <button class="btn-ghost" id="cartClose" style="font-size:24px;background:none;border:none;color:var(--text-2);cursor:pointer;">✕</button>
      </div>
      <div class="cart-drawer-body" id="cartBody"></div>
      <div class="cart-drawer-footer hidden" id="cartFooter">
        <div class="cart-total-row">
          <span class="cart-total-label">Total</span>
          <span class="cart-total-value" id="cartTotalValue">R$ 0,00</span>
        </div>
        <a href="/checkout.html" class="btn btn-primary btn-lg btn-block">Finalizar Pedido</a>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('cartOverlay').addEventListener('click', closeCartDrawer);
  document.getElementById('cartClose').addEventListener('click', closeCartDrawer);
}

function renderCartItems() {
  const cart = getCart();
  const body = document.getElementById('cartBody');
  const footer = document.getElementById('cartFooter');
  if (!body) return;

  if (cart.length === 0) {
    body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🛒</div><div class="empty-state-title">Carrinho vazio</div><div class="empty-state-desc">Adicione itens do cardápio</div></div>`;
    footer?.classList.add('hidden');
    return;
  }

  body.innerHTML = cart.map(item => `
    <div class="cart-item fade-in">
      <span class="cart-item-icon">${item.image_url || '📦'}</span>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${formatBRL(item.price_cents * item.quantity)}</div>
      </div>
      <div class="cart-item-controls">
        <button class="cart-item-qty-btn" data-action="dec" data-id="${item.id}">−</button>
        <span class="cart-item-qty">${item.quantity}</span>
        <button class="cart-item-qty-btn" data-action="inc" data-id="${item.id}">+</button>
        <button class="cart-item-remove" data-action="remove" data-id="${item.id}">🗑</button>
      </div>
    </div>
  `).join('');

  body.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const item = cart.find(i => i.id === id);
      if (!item) return;
      if (action === 'inc') updateQuantity(id, item.quantity + 1);
      else if (action === 'dec') updateQuantity(id, item.quantity - 1);
      else if (action === 'remove') removeFromCart(id);
      renderCartItems();
      updateCartBadge();
    });
  });

  footer?.classList.remove('hidden');
  const totalEl = document.getElementById('cartTotalValue');
  if (totalEl) totalEl.textContent = formatBRL(getCartTotal());
}

// Listen for cart updates
window.addEventListener('cart-updated', () => {
  updateCartBadge();
});
