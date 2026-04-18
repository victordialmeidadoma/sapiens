'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardClient from '@/components/DashboardClient';

export default function Home() {
  const [state, setState] = useState({ ready: false, logado: false, nome: '', perfil: '' });

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const meta = session.user.user_metadata || {};
      let nome = meta.nome || session.user.email;
      let perfil = meta.perfil || 'colaborador';

      try {
        const { data: p } = await supabase
          .from('perfis')
          .select('nome, perfil')
          .eq('id', session.user.id)
          .single();
        if (p) {
          nome = p.nome || nome;
          perfil = p.perfil || perfil;
        }
      } catch(e) {}

      setState({ ready: true, logado: true, nome, perfil });
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!state.ready) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:12,fontFamily:'Inter,sans-serif',color:'#6C757D'}}>
      <div style={{width:32,height:32,border:'3px solid #E0E3E8',borderTopColor:'#1B6EC2',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
      <span>Carregando SAPIENS...</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return <DashboardClient userNome={state.nome} userPerfil={state.perfil} />;
}
