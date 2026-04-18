export const dynamic = 'force-dynamic';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function DELETE(req, { params }) {
  const { res } = await requireAdmin(req);
  if (res) return res;
  const db = createAdminClient();
  await db.from('demandas').delete().eq('id', params.did).eq('municipio_id', params.id);
  return NextResponse.json({ ok: true });
}
