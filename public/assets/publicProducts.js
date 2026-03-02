// publicProducts.js — Load and render products from Supabase
import { supabase } from './supabaseClient.js';
import { addToCart } from './cart.js';
import { formatBRL, showToast, updateCartBadge } from './app.js';

export async function loadProducts() {
  const grid = document.getElementById('productGrid');
  const loader = document.getElementById('productLoader');
  if (!grid) return;

  if (loader) loader.classList.remove('hidden');

  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (loader) loader.classList.add('hidden');

  if (error) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">😢</div><div class="empty-state-title">Erro ao carregar</div><div class="empty-state-desc">${error.message}</div></div>`;
    return;
  }

  if (!products || products.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">😅</div><div class="empty-state-title">Nenhum produto disponível</div><div class="empty-state-desc">Volte em breve!</div></div>`;
    return;
  }

  grid.innerHTML = products.map((p, i) => {
    const outOfStock = p.stock !== null && p.stock <= 0;
    return `
      <div class="card product-card fade-up" style="animation-delay:${i * 0.04}s">
        <div class="product-card-img">
          ${p.image_url || '📦'}
          ${outOfStock ? '<div class="out-of-stock-overlay"><span class="badge-pill badge-red">Esgotado</span></div>' : ''}
        </div>
        <div class="product-card-body">
          <div class="product-card-name">${p.name}</div>
          ${p.description ? `<div class="product-card-desc">${p.description}</div>` : '<div class="product-card-desc" style="flex:1"></div>'}
          <div class="product-card-footer">
            <span class="product-card-price">${formatBRL(p.price_cents)}</span>
            <button class="btn btn-primary btn-sm add-to-cart-btn" data-product='${JSON.stringify(p).replace(/'/g, '&#39;')}' ${outOfStock ? 'disabled' : ''}>
              ＋ Adicionar
            </button>
          </div>
          ${(p.stock !== null && p.stock > 0 && p.stock <= 10) ? `<div class="product-card-stock">⚡ Apenas ${p.stock} restantes</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners
  grid.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const product = JSON.parse(btn.dataset.product);
      addToCart(product);
      showToast(`${product.name} adicionado! 🎉`);
      updateCartBadge();
      // Visual feedback
      const original = btn.innerHTML;
      btn.innerHTML = '✓ Adicionado';
      btn.style.background = 'var(--green)';
      setTimeout(() => { btn.innerHTML = original; btn.style.background = ''; }, 600);
    });
  });
}
