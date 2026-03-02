// adminProducts.js — Products CRUD for admin panel
import { supabase } from './supabaseClient.js';
import { formatBRL, showToast } from './app.js';

let allProducts = [];

export async function loadAdminProducts() {
  const grid = document.getElementById('adminProductGrid');
  const loader = document.getElementById('adminProductLoader');
  if (!grid) return;

  if (loader) loader.classList.remove('hidden');

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (loader) loader.classList.add('hidden');
  if (error) { showToast('Erro: ' + error.message, 'error'); return; }

  allProducts = data || [];
  const countEl = document.getElementById('productCount');
  if (countEl) countEl.textContent = `${allProducts.length} produto${allProducts.length !== 1 ? 's' : ''}`;
  renderAdminProducts();
}

export function renderAdminProducts(filter = 'all', search = '') {
  const grid = document.getElementById('adminProductGrid');
  if (!grid) return;

  let filtered = allProducts.filter(p => {
    const matchFilter = filter === 'all' || (filter === 'active' ? p.active : !p.active);
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">📦</div><div class="empty-state-title">Nenhum produto</div><div class="empty-state-desc">Crie um novo produto ou ajuste os filtros</div></div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <div class="admin-product-card ${p.active ? '' : 'inactive'} fade-in">
      <div class="admin-product-card-header">
        <div class="admin-product-card-info">
          <span class="admin-product-card-emoji">${p.image_url || '📦'}</span>
          <div>
            <div class="admin-product-card-name">${p.name}</div>
            <div class="admin-product-card-desc">${p.description || 'Sem descrição'}</div>
          </div>
        </div>
        <span class="badge-pill ${p.active ? 'badge-green' : 'badge-dim'}">${p.active ? 'Ativo' : 'Inativo'}</span>
      </div>
      <div class="admin-product-card-footer">
        <div>
          <span class="admin-product-card-price">${formatBRL(p.price_cents)}</span>
          ${p.stock != null ? `<span class="admin-product-card-stock">Est: ${p.stock}</span>` : ''}
        </div>
        <div class="admin-product-card-actions">
          <button class="btn btn-ghost btn-icon" onclick="editProduct('${p.id}')" title="Editar">✏️</button>
          <button class="btn btn-ghost btn-icon" onclick="toggleProduct('${p.id}')" title="${p.active ? 'Desativar' : 'Ativar'}">${p.active ? '👁' : '🔄'}</button>
          <button class="btn btn-ghost btn-icon" onclick="confirmDeleteProduct('${p.id}')" title="Excluir" style="color:var(--red)">🗑</button>
        </div>
      </div>
    </div>
  `).join('');
}

const EMOJIS = ['🍗','🥟','🧀','🍫','🥤','🧃','🌭','🍰','🍕','🥪','🍔','🌮','🍿','☕','🧁','🍩','📦'];

export function openProductModal(product = null) {
  const overlay = document.getElementById('productModalOverlay');
  const title = document.getElementById('productModalTitle');
  const form = document.getElementById('productModalForm');

  title.textContent = product ? 'Editar Produto' : 'Novo Produto';

  form.innerHTML = `
    <input type="hidden" id="productEditId" value="${product?.id || ''}">
    <div class="form-group">
      <label class="form-label">Nome *</label>
      <input type="text" class="form-input" id="prodName" value="${product?.name || ''}" placeholder="Nome do produto">
    </div>
    <div class="form-group">
      <label class="form-label">Descrição</label>
      <textarea class="form-textarea" id="prodDesc" placeholder="Descrição opcional">${product?.description || ''}</textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      <div class="form-group">
        <label class="form-label">Preço (centavos) *</label>
        <input type="number" class="form-input" id="prodPrice" value="${product?.price_cents || ''}" placeholder="600 = R$ 6,00" min="0">
      </div>
      <div class="form-group">
        <label class="form-label">Estoque</label>
        <input type="number" class="form-input" id="prodStock" value="${product?.stock ?? ''}" placeholder="Opcional" min="0">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Ícone</label>
      <div class="emoji-picker" id="emojiPicker">
        ${EMOJIS.map(e => `<button type="button" class="emoji-btn ${(product?.image_url === e) ? 'selected' : ''}" data-emoji="${e}">${e}</button>`).join('')}
      </div>
      <input type="hidden" id="prodImageUrl" value="${product?.image_url || ''}">
    </div>
    <div class="toggle mb-4" id="prodActiveToggle">
      <div class="toggle-track ${product?.active !== false ? 'on' : ''}">
        <div class="toggle-thumb"></div>
      </div>
      <span class="toggle-label">${product?.active !== false ? 'Ativo' : 'Inativo'}</span>
      <input type="hidden" id="prodActive" value="${product?.active !== false ? 'true' : 'false'}">
    </div>
  `;

  // Emoji picker
  form.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      form.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('prodImageUrl').value = btn.dataset.emoji;
    });
  });

  // Toggle
  document.getElementById('prodActiveToggle').addEventListener('click', () => {
    const input = document.getElementById('prodActive');
    const track = document.querySelector('#prodActiveToggle .toggle-track');
    const label = document.querySelector('#prodActiveToggle .toggle-label');
    const isOn = input.value === 'true';
    input.value = isOn ? 'false' : 'true';
    track.classList.toggle('on', !isOn);
    label.textContent = !isOn ? 'Ativo' : 'Inativo';
  });

  overlay.classList.add('open');
}

export function closeProductModal() {
  document.getElementById('productModalOverlay')?.classList.remove('open');
}

export async function saveProduct() {
  const id = document.getElementById('productEditId')?.value;
  const name = document.getElementById('prodName')?.value?.trim();
  const desc = document.getElementById('prodDesc')?.value?.trim();
  const price = parseInt(document.getElementById('prodPrice')?.value);
  const stock = document.getElementById('prodStock')?.value;
  const imageUrl = document.getElementById('prodImageUrl')?.value;
  const active = document.getElementById('prodActive')?.value === 'true';

  if (!name) { showToast('Nome é obrigatório', 'error'); return; }
  if (isNaN(price) || price < 0) { showToast('Preço inválido', 'error'); return; }

  const payload = {
    name,
    description: desc || null,
    price_cents: price,
    image_url: imageUrl || null,
    active,
    stock: stock ? parseInt(stock) : null,
  };

  let error;
  if (id) {
    ({ error } = await supabase.from('products').update(payload).eq('id', id));
  } else {
    ({ error } = await supabase.from('products').insert(payload));
  }

  if (error) { showToast('Erro: ' + error.message, 'error'); return; }

  showToast(id ? 'Produto atualizado!' : 'Produto criado!');
  closeProductModal();
  await loadAdminProducts();
}

export async function toggleProduct(id) {
  const product = allProducts.find(p => p.id === id);
  if (!product) return;
  const { error } = await supabase.from('products').update({ active: !product.active }).eq('id', id);
  if (error) { showToast('Erro: ' + error.message, 'error'); return; }
  showToast(product.active ? 'Produto desativado' : 'Produto ativado');
  await loadAdminProducts();
}

export async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) { showToast('Erro: ' + error.message, 'error'); return; }
  showToast('Produto excluído');
  closeDeleteModal();
  await loadAdminProducts();
}

let deleteTargetId = null;
export function confirmDeleteProduct(id) {
  deleteTargetId = id;
  const product = allProducts.find(p => p.id === id);
  document.getElementById('deleteProductName').textContent = product?.name || '';
  document.getElementById('deleteModalOverlay').classList.add('open');
}
export function closeDeleteModal() {
  document.getElementById('deleteModalOverlay')?.classList.remove('open');
}
export function doDeleteProduct() {
  if (deleteTargetId) deleteProduct(deleteTargetId);
}

// Expose to window for onclick handlers
window.editProduct = (id) => openProductModal(allProducts.find(p => p.id === id));
window.toggleProduct = toggleProduct;
window.confirmDeleteProduct = confirmDeleteProduct;
