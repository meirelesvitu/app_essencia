// cart.js — Cart management with localStorage
const CART_KEY = 'cantina_cart';

export function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}

export function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent('cart-updated', { detail: cart }));
}

export function addToCart(product) {
  const cart = getCart();
  const existing = cart.find(i => i.id === product.id);
  if (existing) { existing.quantity += 1; }
  else { cart.push({ id: product.id, name: product.name, price_cents: product.price_cents, image_url: product.image_url, quantity: 1 }); }
  saveCart(cart);
}

export function updateQuantity(productId, qty) {
  let cart = getCart();
  if (qty <= 0) { cart = cart.filter(i => i.id !== productId); }
  else { const item = cart.find(i => i.id === productId); if (item) item.quantity = qty; }
  saveCart(cart);
}

export function removeFromCart(productId) {
  saveCart(getCart().filter(i => i.id !== productId));
}

export function clearCart() {
  saveCart([]);
}

export function getCartTotal() {
  return getCart().reduce((sum, i) => sum + i.price_cents * i.quantity, 0);
}

export function getCartCount() {
  return getCart().reduce((sum, i) => sum + i.quantity, 0);
}
