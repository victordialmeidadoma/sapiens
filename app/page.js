'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardClient from '@/components/DashboardClient';

export default function Home() {
  const [state, setState] = useState({ ready: false, erro: null, nome: '', perfil: '' });

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      
      // Tenta pegar sessão
      const { data, error } = await supabase.auth.getSession();
      
      if (error || !data.session) {
        // Sem sessão — redireciona para login
        window.location.href = '/login';
        return;
      }

      const user = data.session.user;
      const meta = user.user_metadata || {};
      
      setState({
        ready: true,
        erro: null,
        nome: meta.nome || user.email,
        perfil: meta.perfil || 'colaborador'
      });
    }

    init();
  }, []);

  if (!state.ready) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:12,fontFamily:'Inter,sans-serif',color:'#6C757D'}}>
      <div style={{width:32,height:32,border:'3px solid #E0E3E8',borderTopColor:'#1B6EC2',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
      <span>Carregando...</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return <DashboardClient userNome={state.nome} userPerfil={state.perfil} />;
}
