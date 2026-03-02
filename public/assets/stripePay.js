// stripePay.js — Stripe frontend integration (used on success page)
import { supabase } from './supabaseClient.js';

export async function checkSessionStatus(sessionId) {
  if (!sessionId) return null;

  // Try to find the order by session ID
  const { data: order, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('stripe_checkout_session_id', sessionId)
    .single();

  if (error || !order) return null;
  return order;
}
