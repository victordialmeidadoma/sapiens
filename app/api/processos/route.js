export const dynamic = 'force-dynamic';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const { res } = await requireAuth(req);
  if (res) return res;

  const db = createAdminClient();
  const { data, error } = await db
    .from('processos')
    .select('*')
    .order('pr', { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sort: processos with deadline first, nulls last
  const sorted = [...(data || [])].sort((a, b) => {
    const da = a.pr || a.pz, db2 = b.pr || b.pz;
    if (!da && !db2) return 0;
    if (!da) return 1;
    if (!db2) return -1;
    return da.localeCompare(db2);
  });

  return NextResponse.json(sorted);
}

export async function POST(req) {
  const { res } = await requireAdmin(req);
  if (res) return res;

  const d = await req.json();
  const db = createAdminClient();

  const { data, error } = await db
    .from('processos')
    .insert({
      proc: d.proc, et: d.et, sit: d.sit, ex: d.ex, ass: d.ass,
      mun: d.mun, tipo_ente: d.tipo_ente, gestor: d.gestor,
      natureza: d.natureza, especie: d.especie, relator: d.relator,
      resp: d.resp, resp_int: d.ri, cit: d.cit, pz: d.pz, pr: d.pr,
      pi: d.pi, pp: d.pp, obs: d.obs, ac: d.ac, mt: d.mt, md: d.md, atencao: d.atencao||false, atencao_obs: d.atencao_obs||null,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}