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
    .eq('id', session.user.id)
    .single();

  if (!profile || profile.role !== 'ADMIN') {
    await supabase.auth.signOut();
    return null;
  }

  return { user: session.user, role: profile.role };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // Verify admin role
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (profErr || !profile || profile.role !== 'ADMIN') {
    await supabase.auth.signOut();
    throw new Error('Acesso negado: usuário não é admin');
  }

  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/admin/login.html';
}

export async function requireAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/admin/login.html';
    return null;
  }
  
  const admin = await checkAdmin();
  if (!admin) {
    alert("Acesso negado: sem permissão de administrador.");
    window.location.href = '/admin/login.html';
    return null;
  }
  return admin;
}
