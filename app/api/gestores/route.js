import { requireAuth, requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  const { res } = await requireAuth();
  if (res) return res;
  const db = createAdminClient();
  const { data, error } = await db.from('gestores').select('*').order('nome');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req) {
  const { res } = await requireAdmin();
  if (res) return res;
  const d = await req.json();
  const db = createAdminClient();
  const { data, error } = await db.from('gestores')
    .insert({ nome: d.nome, cargo: d.cargo, municipio: d.municipio, tel: d.tel, email: d.email, contrato_tipo: d.contratoTipo, inicio: d.inicio, status: d.status || 'Ativo', obs: d.obs })
    .select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
