export const dynamic = 'force-dynamic';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST(req, { params }) {
  const { res } = await requireAdmin(req);
  if (res) return res;
  const d = await req.json();
  const db = createAdminClient();
  const { data, error } = await db.from('mandatos')
    .insert({ municipio_id: params.id, gestor: d.gestor, inicio: d.inicio, fim: d.fim, escopo: d.escopo, contratocom: d.contratocom, status: d.status || 'Ativo' })
    .select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
