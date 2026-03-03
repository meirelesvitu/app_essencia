// adminAuth.js — Admin authentication via Supabase Auth
import { supabase } from './supabaseClient.js';

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getMyRole() {
  const session = await getSession();
  if (!session) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (!profile) return null;
  return profile.role;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // Verify admin role
  const role = await getMyRole();

  if (role !== 'ADMIN') {
    await signOut();
    throw new Error('Sem permissão');
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

  const role = await getMyRole();
  if (role !== 'ADMIN') {
    alert("Sem permissão");
    await signOut();
    return null;
  }
  return { user: session.user, role };
}
