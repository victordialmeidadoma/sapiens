import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  const { res } = await requireAdmin();
  if (res) return res;
  const db = createAdminClient();
  const { data, error } = await db.from('perfis').select('id, nome, perfil, ativo, created_at').order('nome');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Get emails from auth.users
  const { data: { users } } = await db.auth.admin.listUsers();
  const emailMap = Object.fromEntries((users || []).map(u => [u.id, u.email]));
  return NextResponse.json((data || []).map(u => ({ ...u, email: emailMap[u.id] || '' })));
}

export async function POST(req) {
  const { res } = await requireAdmin();
  if (res) return res;
  const d = await req.json();
  if (!d.email || !d.senha || !d.nome) return NextResponse.json({ error: 'nome, email e senha obrigatorios' }, { status: 400 });
  const db = createAdminClient();
  const { data, error } = await db.auth.admin.createUser({
    email: d.email.toLowerCase(),
    password: d.senha,
    email_confirm: true,
    user_metadata: { nome: d.nome, perfil: d.perfil || 'colaborador' }
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  // Update perfil table (trigger should handle it, but ensure it exists)
  await db.from('perfis').upsert({ id: data.user.id, nome: d.nome, perfil: d.perfil || 'colaborador', ativo: true });
  return NextResponse.json({ id: data.user.id }, { status: 201 });
}
