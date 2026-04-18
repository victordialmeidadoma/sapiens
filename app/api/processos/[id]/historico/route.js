import { requireAuth, requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  const { res } = await requireAuth();
  if (res) return res;

  const db = createAdminClient();
  const { data, error } = await db
    .from('historico')
    .select('*')
    .eq('processo_id', params.id)
    .order('id', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req, { params }) {
  const { res } = await requireAdmin();
  if (res) return res;

  const d = await req.json();
  const db = createAdminClient();

  const { data, error } = await db
    .from('historico')
    .insert({ processo_id: params.id, tipo: d.tipo, data: d.data, descricao: d.descricao, tce: !!d.tce })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
