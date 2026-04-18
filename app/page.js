'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardClient from '@/components/DashboardClient';

export default function Home() {
  const [state, setState] = useState({ loading: true, user: null, perfil: null, nome: null });

  useEffect(() => {
    async function init() {
      const supabase = createClient();

      // Espera a sessão estar pronta
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/login'; return; }

      const user = session.user;
      const meta = user.user_metadata || {};

      // Tenta buscar perfil do banco, mas usa metadata como fallback
      let nome = meta.nome || user.email;
      let perfil = meta.perfil || 'colaborador';

      try {
        const { data: p } = await supabase
          .from('perfis')
          .select('nome, perfil')
          .eq('id', user.id)
          .single();
        if (p) { nome = p.nome || nome; perfil = p.perfil || perfil; }
      } catch(e) {}

      setState({ loading: false, user, perfil, nome });
    }
    init();
  }, []);

  if (state.loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:12,fontFamily:'Inter,sans-serif',color:'#6C757D'}}>
      <div style={{width:32,height:32,border:'3px solid #E0E3E8',borderTopColor:'#1B6EC2',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
      <span>Carregando SAPIENS...</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return <DashboardClient userNome={state.nome} userPerfil={state.perfil} />;
}
