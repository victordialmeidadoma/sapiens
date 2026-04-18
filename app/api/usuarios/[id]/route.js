export const dynamic = 'force-dynamic';
import { requireAdmin, getSessionUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
  const { res } = await requireAdmin();
  if (res) return res;
  const d = await req.json();
  const db = createAdminClient();
  // Update perfil
  await db.from('perfis').update({ nome: d.nome, perfil: d.perfil || 'colaborador', ativo: d.ativo !== false }).eq('id', params.id);
  // Update email/password if provided
  const updates = {};
  if (d.email) updates.email = d.email.toLowerCase();
  if (d.senha) updates.password = d.senha;
  if (Object.keys(updates).length) {
    await db.auth.admin.updateUserById(params.id, updates);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { user, res } = await requireAdmin();
  if (res) return res;
  if (user.id === params.id) return NextResponse.json({ error: 'Voce nao pode excluir sua propria conta' }, { status: 400 });
  const db = createAdminClient();
  await db.auth.admin.deleteUser(params.id);
  return NextResponse.json({ ok: true });
}
