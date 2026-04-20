export const dynamic = 'force-dynamic';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'anexos';

export async function GET(req, { params }) {
  const { res } = await requireAuth(req);
  if (res) return res;

  const db = createAdminClient();
  const { data: anexo } = await db.from('anexos').select('*').eq('id', params.aid).eq('processo_id', params.id).single();
  if (!anexo) return NextResponse.json({ error: 'Arquivo nao encontrado' }, { status: 404 });

  // Download file from storage and stream it directly
  const { data, error } = await db.storage.from(BUCKET).download(anexo.storage_path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const arrayBuffer = await data.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': anexo.mimetype || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(anexo.nome)}"`,
    },
  });
}

export async function DELETE(req, { params }) {
  const { res } = await requireAdmin(req);
  if (res) return res;

  const db = createAdminClient();
  const { data: anexo } = await db.from('anexos').select('storage_path').eq('id', params.aid).single();
  if (anexo?.storage_path) {
    await db.storage.from(BUCKET).remove([anexo.storage_path]);
  }
  await db.from('anexos').delete().eq('id', params.aid);
  return NextResponse.json({ ok: true });
}