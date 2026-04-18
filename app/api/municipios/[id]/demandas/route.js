export const dynamic = 'force-dynamic';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST(req, { params }) {
  const { res } = await requireAdmin(req);
  if (res) return res;
  const d = await req.json();
  const db = createAdminClient();
  const { data, error } = await db.from('demandas')
    .insert({ municipio_id: params.id, tipo: d.tipo, data: d.data, descricao: d.descricao, status: d.status || 'Em andamento', procvinc: d.procvinc })
    .select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
