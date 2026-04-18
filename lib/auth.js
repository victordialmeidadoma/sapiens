import { createClient } from './supabase/server';
import { createAdminClient } from './supabase/admin';
import { NextResponse } from 'next/server';

// Get current user + perfil from session (for API routes)
export async function getSessionUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from('perfis')
    .select('perfil, nome, ativo')
    .eq('id', user.id)
    .single();

  if (!perfil || !perfil.ativo) return null;
  return { ...user, perfil: perfil.perfil, nome: perfil.nome };
}

// Returns 401 JSON if not authenticated
export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, res: NextResponse.json({ error: 'Nao autenticado' }, { status: 401 }) };
  }
  return { user, res: null };
}

// Returns 403 JSON if not admin
export async function requireAdmin() {
  const { user, res } = await requireAuth();
  if (res) return { user: null, res };
  if (user.perfil !== 'admin') {
    return { user: null, res: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) };
  }
  return { user, res: null };
}
