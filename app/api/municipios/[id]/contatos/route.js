import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST(req, { params }) {
  const { res } = await requireAdmin();
  if (res) return res;
  const d = await req.json();
  const db = createAdminClient();
  const { data, error } = await db.from('contatos')
    .insert({ municipio_id: params.id, nome: d.nome, cargo: d.cargo, tel: d.tel, email: d.email })
    .select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
