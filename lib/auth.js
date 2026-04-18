import { createAdminClient } from './supabase/admin';
import { NextResponse } from 'next/server';

export async function requireAuth(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return { user: null, res: NextResponse.json({ error: 'Nao autenticado' }, { status: 401 }) };

  const db = createAdminClient();
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return { user: null, res: NextResponse.json({ error: 'Nao autenticado' }, { status: 401 }) };

  const { data: perfil } = await db.from('perfis').select('perfil, nome').eq('id', user.id).single();
  return { user: { ...user, perfil: perfil?.perfil || 'colaborador', nome: perfil?.nome }, res: null };
}

export async function requireAdmin(req) {
  const { user, res } = await requireAuth(req);
  if (res) return { user: null, res };
  if (user.perfil !== 'admin') return { user: null, res: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) };
  return { user, res: null };
}
