export const dynamic = 'force-dynamic';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const { res } = await requireAuth(req);
  if (res) return res;
  const db = createAdminClient();
  const { data, error } = await db.from('conselheiros').select('*').order('tipo').order('nome');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req) {
  const { res } = await requireAdmin(req);
  if (res) return res;
  const d = await req.json();
  if (!d.nome || !d.tipo) return NextResponse.json({ error: 'nome e tipo obrigatorios' }, { status: 400 });
  const db = createAdminClient();
  const titulo = d.tipo === 'Conselheiro' ? `Conselheiro ${d.nome}` : `Conselheiro-Substituto ${d.nome}`;
  const { data, error } = await db.from('conselheiros')
    .insert({ nome: d.nome, tipo: d.tipo, titulo, ativo: true })
    .select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}