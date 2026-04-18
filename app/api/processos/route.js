export const dynamic = 'force-dynamic';
import { requireAuth } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    const { res } = await requireAuth(req);
    if (res) return res;

    const db = createAdminClient();
    const { data, error } = await db.from('processos').select('*');
    
    if (error) {
      console.error('DB error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const sorted = [...(data || [])].sort((a, b) => {
      const da = a.pr || a.pz, db2 = b.pr || b.pz;
      if (!da && !db2) return 0;
      if (!da) return 1;
      if (!db2) return -1;
      return da.localeCompare(db2);
    });

    return NextResponse.json(sorted);
  } catch(e) {
    console.error('processos GET error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { res } = await requireAuth(req);
    if (res) return res;

    const d = await req.json();
    const db = createAdminClient();

    const { data, error } = await db.from('processos').insert({
      proc: d.proc, et: d.et, sit: d.sit, ex: d.ex, ass: d.ass,
      mun: d.mun, tipo_ente: d.tipo_ente, gestor: d.gestor,
      natureza: d.natureza, especie: d.especie, relator: d.relator,
      resp: d.resp, resp_int: d.ri, cit: d.cit, pz: d.pz, pr: d.pr,
      pi: d.pi, pp: d.pp, obs: d.obs, ac: d.ac, mt: d.mt, md: d.md,
    }).select('id').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch(e) {
    console.error('processos POST error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
