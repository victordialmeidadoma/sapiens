export const dynamic = 'force-dynamic';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
  const { res } = await requireAdmin();
  if (res) return res;
  const d = await req.json();
  const db = createAdminClient();
  await db.from('gestores').update({ nome: d.nome, cargo: d.cargo, municipio: d.municipio, tel: d.tel, email: d.email, contrato_tipo: d.contratoTipo, inicio: d.inicio, status: d.status, obs: d.obs }).eq('id', params.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { res } = await requireAdmin();
  if (res) return res;
  const db = createAdminClient();
  await db.from('gestores').delete().eq('id', params.id);
  return NextResponse.json({ ok: true });
}
