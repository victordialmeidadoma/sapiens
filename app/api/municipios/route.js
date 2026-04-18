export const dynamic = 'force-dynamic';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  const { res } = await requireAuth();
  if (res) return res;

  const db = createAdminClient();
  const { data: muns, error } = await db.from('municipios').select('*').order('nome');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch related data for all municipalities in parallel
  const enriched = await Promise.all(muns.map(async (m) => {
    const [{ data: mandatos }, { data: contatos }, { data: demandas }] = await Promise.all([
      db.from('mandatos').select('*').eq('municipio_id', m.id).order('id', { ascending: false }),
      db.from('contatos').select('*').eq('municipio_id', m.id),
      db.from('demandas').select('*').eq('municipio_id', m.id).order('id', { ascending: false }),
    ]);
    return { ...m, mandatos: mandatos || [], contatos: contatos || [], demandas: demandas || [] };
  }));

  return NextResponse.json(enriched);
}

export async function POST(req) {
  const { res } = await requireAdmin();
  if (res) return res;

  const d = await req.json();
  const db = createAdminClient();
  const { data, error } = await db
    .from('municipios')
    .insert({ nome: d.nome, tipo: d.tipo || 'Prefeitura', estado: d.estado || 'Maranhao', logo: d.logo, obs: d.obs })
    .select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
