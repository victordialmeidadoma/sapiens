import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function PUT(req, { params }) {
  const { res } = await requireAdmin();
  if (res) return res;
  const d = await req.json();
  const db = createAdminClient();
  const { error } = await db.from('municipios')
    .update({ nome: d.nome, tipo: d.tipo, estado: d.estado, logo: d.logo, obs: d.obs })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { res } = await requireAdmin();
  if (res) return res;
  const db = createAdminClient();
  await db.from('municipios').delete().eq('id', params.id);
  return NextResponse.json({ ok: true });
}
