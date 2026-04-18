import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const { user, res } = await requireAuth();
  if (res) return res;
  return NextResponse.json({ id: user.id, nome: user.nome, perfil: user.perfil });
}
