export const dynamic = 'force-dynamic';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  const { res } = await requireAuth(req);
  if (res) return res;

  const db = createAdminClient();
  const { data, error } = await db.from('processos').select('*').eq('id', params.id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req, { params }) {
  const { res } = await requireAdmin(req);
  if (res) return res;

  const d = await req.json();
  const db = createAdminClient();

  const { error } = await db.from('processos').update({
    proc: d.proc, et: d.et, sit: d.sit, ex: d.ex, ass: d.ass,
    mun: d.mun, tipo_ente: d.tipo_ente, gestor: d.gestor,
    natureza: d.natureza, especie: d.especie, relator: d.relator,
    resp: d.resp, resp_int: d.ri, cit: d.cit, pz: d.pz, pr: d.pr,
    pi: d.pi, pp: d.pp, obs: d.obs, ac: d.ac, mt: d.mt, md: d.md,
  }).eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { res } = await requireAdmin(req);
  if (res) return res;

  const db = createAdminClient();
  const { error } = await db.from('processos').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
