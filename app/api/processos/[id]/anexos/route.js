export const dynamic = 'force-dynamic';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'anexos';

export async function GET(req, { params }) {
  const { res } = await requireAuth(req);
  if (res) return res;

  const db = createAdminClient();
  const { data, error } = await db
    .from('anexos')
    .select('id, nome, tamanho, mimetype, created_at')
    .eq('processo_id', params.id)
    .order('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req, { params }) {
  const { res } = await requireAdmin(req);
  if (res) return res;

  const formData = await req.formData();
  const file = formData.get('file');
  if (!file) return NextResponse.json({ error: 'Arquivo nao encontrado' }, { status: 400 });

  const db = createAdminClient();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const storagePath = `processos/${params.id}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data, error } = await db
    .from('anexos')
    .insert({ processo_id: params.id, nome: file.name, tamanho: file.size, mimetype: file.type, storage_path: storagePath })
    .select('id, nome, tamanho')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
