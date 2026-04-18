import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import SapiensApp from '@/components/SapiensApp';

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const db = createAdminClient();
  const { data: perfil } = await db
    .from('perfis')
    .select('nome, perfil')
    .eq('id', user.id)
    .single();

  return (
    <SapiensApp
      userNome={perfil?.nome || user.email}
      userPerfil={perfil?.perfil || 'colaborador'}
    />
  );
}
