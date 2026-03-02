// adminAuth.js — Admin authentication via Supabase Auth
import { supabase } from './supabaseClient.js';

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function checkAdmin() {
  const session = await getSession();
  if (!session) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', session.user.id)
    .single();

  if (!profile || profile.role !== 'ADMIN') {
    await supabase.auth.signOut();
    return null;
  }

  return { user: session.user, role: profile.role };
}

export async function adminLogin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // Verify admin role
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', data.user.id)
    .single();

  if (profErr || !profile || profile.role !== 'ADMIN') {
    await supabase.auth.signOut();
    throw new Error('Acesso negado: usuário não é admin');
  }

  return data;
}

export async function adminLogout() {
  await supabase.auth.signOut();
  window.location.href = '/admin/login.html';
}

export async function guardAdmin() {
  const admin = await checkAdmin();
  if (!admin) {
    window.location.href = '/admin/login.html';
    return null;
  }
  return admin;
}
