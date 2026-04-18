import { requireAuth, requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'anexos';

export async function GET(req, { params }) {
  const { res } = await requireAuth();
  if (res) return res;

  const db = createAdminClient();
  const { data: anexo } = await db.from('anexos').select('*').eq('id', params.aid).eq('processo_id', params.id).single();
  if (!anexo) return NextResponse.json({ error: 'Arquivo nao encontrado' }, { status: 404 });

  // Generate signed URL valid for 60 seconds
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(anexo.storage_path, 60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.redirect(data.signedUrl);
}

export async function DELETE(req, { params }) {
  const { res } = await requireAdmin();
  if (res) return res;

  const db = createAdminClient();
  const { data: anexo } = await db.from('anexos').select('storage_path').eq('id', params.aid).single();

  if (anexo?.storage_path) {
    await db.storage.from(BUCKET).remove([anexo.storage_path]);
  }

  await db.from('anexos').delete().eq('id', params.aid);
  return NextResponse.json({ ok: true });
}
