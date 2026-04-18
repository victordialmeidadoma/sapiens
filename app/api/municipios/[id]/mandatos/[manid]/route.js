export const dynamic = 'force-dynamic';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function DELETE(req, { params }) {
  const { res } = await requireAdmin();
  if (res) return res;
  const db = createAdminClient();
  await db.from('mandatos').delete().eq('id', params.manid).eq('municipio_id', params.id);
  return NextResponse.json({ ok: true });
}
