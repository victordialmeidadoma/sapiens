import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { user, res } = await requireAuth(req);
  if (res) return res;
  return NextResponse.json({ id: user.id, nome: user.nome, perfil: user.perfil });
}
