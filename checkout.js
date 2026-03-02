// checkout.js — Checkout flow: create order in Supabase, then pay via Stripe
import { supabase, SUPABASE_URL } from './supabaseClient.js';
import { SUPABASE_ANON_KEY, STRIPE_PUBLISHABLE_KEY } from './config.js';
import { getCart, clearCart, getCartTotal } from './cart.js';
import { formatBRL, showToast } from './app.js';

let currentOrderId = null;

export function initCheckout() {
  const cart = getCart();
  if (cart.length === 0) {
    window.location.href = '/';
    return;
  }

  renderSummary(cart);
  renderForm();
}

function renderSummary(cart) {
  const el = document.getElementById('checkoutSummary');
  if (!el) return;

  el.innerHTML = `
    <div class="section-box-title">Resumo do Pedido</div>
    ${cart.map(item => `
      <div class="summary-row">
        <div class="summary-item-left">
          <span class="summary-item-icon">${item.image_url || '📦'}</span>
          <div>
            <div class="summary-item-name">${item.name}</div>
            <div class="summary-item-qty">Qtd: ${item.quantity}</div>
          </div>
        </div>
        <span class="summary-item-price">${formatBRL(item.price_cents * item.quantity)}</span>
      </div>
    `).join('')}
    <div class="summary-total">
      <span class="summary-total-label">Total</span>
      <span class="summary-total-value">${formatBRL(getCartTotal())}</span>
    </div>
  `;
}

function renderForm() {
  const form = document.getElementById('checkoutForm');
  if (!form) return;

  form.innerHTML = `
    <div class="section-box-title">Seus Dados</div>
    <div class="form-group">
      <label class="form-label">Nome *</label>
      <input type="text" class="form-input" id="customerName" placeholder="Seu nome completo" required>
      <span class="form-error hidden" id="nameError">Nome é obrigatório</span>
    </div>
    <div class="form-group">
      <label class="form-label">Observações</label>
      <textarea class="form-textarea" id="customerNotes" placeholder="Alguma observação? (opcional)"></textarea>
    </div>
  `;
}

export async function submitOrder() {
  const name = document.getElementById('customerName')?.value?.trim();
  const notes = document.getElementById('customerNotes')?.value?.trim();
  const nameError = document.getElementById('nameError');
  const submitBtn = document.getElementById('submitOrderBtn');

  if (!name) {
    nameError?.classList.remove('hidden');
    document.getElementById('customerName')?.classList.add('error');
    return;
  }
  nameError?.classList.add('hidden');
  document.getElementById('customerName')?.classList.remove('error');

  const cart = getCart();
  if (cart.length === 0) { showToast('Carrinho vazio!', 'error'); return; }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<div class="loader-spinner" style="width:20px;height:20px;border-width:2px;"></div> Criando pedido...';

  try {
    // Create order
    const totalCents = cart.reduce((s, i) => s + i.price_cents * i.quantity, 0);

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        customer_name: name,
        notes: notes || null,
        total_cents: totalCents,
        status: 'RESERVED',
        payment_status: 'PENDING',
      })
      .select()
      .single();

    if (orderErr) throw orderErr;

    // Create order items
    const items = cart.map(item => ({
      order_id: order.id,
      product_id: item.id,
      product_name_snapshot: item.name,
      unit_price_cents_snapshot: item.price_cents,
      quantity: item.quantity,
      subtotal_cents: item.price_cents * item.quantity,
    }));

    const { error: itemsErr } = await supabase.from('order_items').insert(items);
    if (itemsErr) throw itemsErr;

    currentOrderId = order.id;

    // Show payment section
    document.getElementById('checkoutStep1').classList.add('hidden');
    document.getElementById('checkoutStep2').classList.remove('hidden');

    document.getElementById('paymentSummary').innerHTML = `
      <div class="text-center mb-4">
        <div style="font-size:12px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Pedido criado</div>
        <div style="font-family:var(--font-display);font-size:36px;font-weight:800;color:var(--accent);letter-spacing:0.08em;">#${order.order_number}</div>
        <div style="font-size:14px;color:var(--text-2);margin-top:4px;">${name}</div>
      </div>
      <div class="summary-total" style="border-top:1px solid var(--border);padding-top:16px;">
        <span class="summary-total-label">Total a pagar</span>
        <span class="summary-total-value">${formatBRL(totalCents)}</span>
      </div>
    `;

    clearCart();

  } catch (err) {
    showToast('Erro ao criar pedido: ' + err.message, 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Confirmar Pedido';
  }
}

export async function payWithStripe() {
  if (!currentOrderId) { showToast('Pedido não encontrado', 'error'); return; }
  const btn = document.getElementById('stripePayBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="loader-spinner" style="width:20px;height:20px;border-width:2px;border-top-color:#fff;"></div> Redirecionando...';

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ order_id: currentOrderId }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao criar sessão de pagamento');

    // Redirect to Stripe Checkout
    window.location.href = data.url;

  } catch (err) {
    showToast('Erro: ' + err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '💳 Pagar com Stripe';
  }
}

// Make functions available globally for onclick handlers
window.submitOrder = submitOrder;
window.payWithStripe = payWithStripe;
